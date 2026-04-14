const STATUS_TIMEOUT_DEFAULT = 4500;

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const byteFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit"
});

const BYTES_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function initLifecycleRssUI(handlers) {
  const onImportText = handlers.onImportText || (() => {});
  const onImportClipboard = handlers.onImportClipboard || (() => {});
  const onOpenFeed = handlers.onOpenFeed || (() => {});
  const onOpenModal = handlers.onOpenModal || (() => {});
  const onClear = handlers.onClear || (() => {});
  const onSearch = handlers.onSearch || (() => {});

  const openModalButton = document.getElementById("lcr-open-modal-button");
  const openButton = document.getElementById("lcr-open-button");
  const pasteClipboardButton = document.getElementById("lcr-paste-clipboard-button");
  const closeModalButton = document.getElementById("lcr-close-modal-button");
  const modal = document.getElementById("lcr-modal");
  const pasteInput = document.getElementById("lcr-paste-input");
  const modalStatusEl = document.getElementById("lcr-modal-status");
  const clearButton = document.getElementById("lcr-clear-button");
  const searchInput = document.getElementById("lcr-search-input");
  const searchSummary = document.getElementById("lcr-search-summary");
  const resultsBody = document.getElementById("lcr-results-body");
  const spinner = document.getElementById("lcr-dataset-spinner");
  const statusEl = document.getElementById("lcr-dataset-status");

  const datasetFeed = document.getElementById("lcr-dataset-feed");
  const datasetRows = document.getElementById("lcr-dataset-rows");
  const datasetUpdated = document.getElementById("lcr-dataset-updated");
  const datasetSize = document.getElementById("lcr-dataset-size");

  let statusTimeoutId = null;
  let modalStatusTimeoutId = null;
  let datasetLoaded = false;
  let manualPasteMode = false;

  openModalButton.addEventListener("click", () => {
    openModal();
    onOpenModal();
  });

  openButton.addEventListener("click", () => {
    onOpenFeed();
  });

  pasteClipboardButton.addEventListener("click", () => {
    if (manualPasteMode) {
      onImportText(pasteInput.value);
      return;
    }
    onImportClipboard();
  });

  clearButton.addEventListener("click", () => {
    if (!datasetLoaded) return;
    const confirmed = window.confirm("Clear the stored LifeCycle RSS dataset?");
    if (confirmed) {
      onClear();
    }
  });

  const debouncedSearch = debounce((value) => onSearch(value), 120);
  searchInput.addEventListener("input", (event) => {
    debouncedSearch(event.target.value);
  });

  pasteInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      onImportText(pasteInput.value);
    }
  });

  closeModalButton.addEventListener("click", () => {
    closeModal();
  });

  modal.addEventListener("cancel", () => {
    closeModal();
  });

  function renderDatasetReady(meta, storedBytes) {
    datasetLoaded = true;
    spinner.hidden = true;
    datasetFeed.textContent = meta.feedTitle || "—";
    datasetRows.textContent = numberFormatter.format(meta.rowCount ?? 0);
    datasetUpdated.textContent = meta.feedUpdatedAt ? formatDate(meta.feedUpdatedAt) : "—";
    datasetSize.textContent = formatBytes(storedBytes ?? meta.storedBytes ?? 0);
    clearButton.disabled = false;
  }

  function renderDatasetEmpty() {
    datasetLoaded = false;
    spinner.hidden = true;
    datasetFeed.textContent = "—";
    datasetRows.textContent = "0";
    datasetUpdated.textContent = "—";
    datasetSize.textContent = "0 B";
    clearButton.disabled = true;
    searchInput.value = "";
    searchSummary.textContent = "";
    renderResults([], { total: 0, query: "", rowCount: 0 });
  }

  function enableSearch(enabled) {
    searchInput.disabled = !enabled;
    if (!enabled) {
      searchSummary.textContent = "";
    }
  }

  function focusSearch() {
    if (!searchInput.disabled) {
      searchInput.focus();
    }
  }

  function setLoading(isLoading, message) {
    spinner.hidden = !isLoading;
    openModalButton.disabled = isLoading;
    openButton.disabled = isLoading;
    pasteClipboardButton.disabled = isLoading;
    pasteInput.disabled = isLoading;
    clearButton.disabled = isLoading || !datasetLoaded;
    if (isLoading && message) {
      showStatus("info", message);
    }
  }

  function clearPasteInput() {
    pasteInput.value = "";
    pasteInput.hidden = true;
    setClipboardMode();
  }

  function setPasteInputValue(value) {
    pasteInput.value = value;
    pasteInput.hidden = false;
    setManualPasteMode();
    pasteInput.focus();
  }

  function showPasteInput() {
    pasteInput.hidden = false;
    setManualPasteMode();
    pasteInput.focus();
  }

  function openModal() {
    if (typeof modal.showModal === "function" && !modal.open) {
      modal.showModal();
    }
    if (pasteInput.hidden) {
      setClipboardMode();
    }
  }

  function closeModal() {
    if (modal.open) {
      modal.close();
    }
  }

  function setClipboardMode() {
    manualPasteMode = false;
    pasteClipboardButton.textContent = "Paste from clipboard";
  }

  function setManualPasteMode() {
    manualPasteMode = true;
    pasteClipboardButton.textContent = "Import pasted XML";
  }

  function showStatus(level, message, options = {}) {
    const dismissAfter = options.dismissAfter ?? STATUS_TIMEOUT_DEFAULT;
    statusEl.textContent = message;
    statusEl.className = `status-message ${level}`;

    if (statusTimeoutId) {
      window.clearTimeout(statusTimeoutId);
      statusTimeoutId = null;
    }

    if (dismissAfter > 0) {
      statusTimeoutId = window.setTimeout(() => {
        statusEl.textContent = "";
        statusTimeoutId = null;
      }, dismissAfter);
    }
  }

  function showModalStatus(level, message, options = {}) {
    const dismissAfter = options.dismissAfter ?? STATUS_TIMEOUT_DEFAULT;
    modalStatusEl.textContent = message;
    modalStatusEl.className = `rss-modal-status ${level}`;

    if (modalStatusTimeoutId) {
      window.clearTimeout(modalStatusTimeoutId);
      modalStatusTimeoutId = null;
    }

    if (dismissAfter > 0) {
      modalStatusTimeoutId = window.setTimeout(() => {
        modalStatusEl.textContent = "";
        modalStatusEl.className = "rss-modal-status info";
        modalStatusTimeoutId = null;
      }, dismissAfter);
    }
  }

  function renderResults(rows, summary) {
    resultsBody.innerHTML = "";

    const query = summary?.query?.trim() ?? "";
    const total = summary?.total ?? 0;
    const limited = Boolean(summary?.limited);

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.className = "empty-state";
      const td = document.createElement("td");
      td.colSpan = 4;

      if (!datasetLoaded) {
        td.textContent = "Refresh from RSS to enable search.";
      } else if (query) {
        td.textContent = `No matches for “${truncate(query, 80)}”.`;
      } else {
        td.textContent = "Enter a product code to see milestone dates.";
      }

      tr.appendChild(td);
      resultsBody.appendChild(tr);
    } else {
      const frag = document.createDocumentFragment();
      for (const row of rows) {
        const tr = document.createElement("tr");

        const productTd = document.createElement("td");
        productTd.textContent = row.product || "—";
        tr.appendChild(productTd);

        const eooTd = document.createElement("td");
        eooTd.textContent = formatDateDisplay(row.endOfOrderDate);
        tr.appendChild(eooTd);

        const lsedTd = document.createElement("td");
        lsedTd.textContent = formatDateDisplay(row.lastServiceExtensionDate);
        tr.appendChild(lsedTd);

        const eosTd = document.createElement("td");
        eosTd.textContent = formatDateDisplay(row.endOfSupportDate);
        tr.appendChild(eosTd);

        frag.appendChild(tr);
      }
      resultsBody.appendChild(frag);
    }

    if (!datasetLoaded) {
      searchSummary.textContent = "";
    } else if (!query) {
      if (!rows.length) {
        searchSummary.textContent = "";
      } else if (limited) {
        searchSummary.textContent = `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} lines (limited to 200).`;
      } else {
        searchSummary.textContent = `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} lines.`;
      }
    } else if (total === 0) {
      searchSummary.textContent = "No matching lines.";
    } else {
      const limitedCount = rows.length;
      if (limitedCount === total) {
        searchSummary.textContent = `Showing ${limitedCount.toLocaleString()} matching line${total === 1 ? "" : "s"}.`;
      } else {
        searchSummary.textContent = `Showing ${limitedCount.toLocaleString()} of ${total.toLocaleString()} matching lines.`;
      }
    }
  }

  return {
    renderDatasetReady,
    renderDatasetEmpty,
    enableSearch,
    focusSearch,
    setLoading,
    showStatus,
    showModalStatus,
    renderResults,
    clearPasteInput,
    setPasteInputValue,
    showPasteInput,
    closeModal
  };
}

function debounce(callback, delay) {
  let timeoutId = null;
  return (value) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      callback(value);
    }, delay);
  };
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }
  let index = 0;
  let value = bytes;
  while (value >= 1024 && index < BYTES_UNITS.length - 1) {
    value /= 1024;
    index += 1;
  }
  if (index === 0) {
    return `${Math.round(value)} ${BYTES_UNITS[index]}`;
  }
  return `${byteFormatter.format(value)} ${BYTES_UNITS[index]}`;
}

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return dateFormatter.format(parsed);
}

function formatDateDisplay(value) {
  if (!value) return "—";
  const text = String(value).trim();
  if (!text) return "—";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf())) {
    return text;
  }
  return dateFormatter.format(parsed);
}

function truncate(value, maxLength) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
