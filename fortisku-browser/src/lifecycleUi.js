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

export function initLifecycleUI(handlers) {
  const onUpload = handlers.onUpload || (() => {});
  const onClear = handlers.onClear || (() => {});
  const onSearch = handlers.onSearch || (() => {});

  const fileInput = document.getElementById("lc-file-input");
  const clearButton = document.getElementById("lc-clear-button");
  const searchInput = document.getElementById("lc-search-input");
  const searchSummary = document.getElementById("lc-search-summary");
  const resultsBody = document.getElementById("lc-results-body");
  const spinner = document.getElementById("lc-dataset-spinner");
  const statusEl = document.getElementById("lc-dataset-status");

  const datasetSheet = document.getElementById("lc-dataset-sheet");
  const datasetRows = document.getElementById("lc-dataset-rows");
  const datasetUpdated = document.getElementById("lc-dataset-updated");
  const datasetSize = document.getElementById("lc-dataset-size");

  let statusTimeoutId = null;
  let datasetLoaded = false;
  let lastRenderedRows = [];

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) {
      onUpload({ file });
    }
    fileInput.value = "";
  });

  clearButton.addEventListener("click", () => {
    if (!datasetLoaded) return;
    const confirmed = window.confirm("Clear the stored LifeCycle dataset?");
    if (confirmed) {
      onClear();
    }
  });

  const debouncedSearch = debounce((value) => onSearch(value), 120);
  searchInput.addEventListener("input", (event) => {
    debouncedSearch(event.target.value);
  });

  function renderDatasetReady(meta, storedBytes) {
    datasetLoaded = true;
    spinner.hidden = true;
    datasetSheet.textContent = meta.sheetName || "—";
    datasetRows.textContent = numberFormatter.format(meta.rowCount ?? 0);
    datasetUpdated.textContent = meta.updatedAt ? formatDate(meta.updatedAt) : "—";
    datasetSize.textContent = formatBytes(storedBytes ?? meta.storedBytes ?? 0);
    clearButton.disabled = false;
  }

  function renderDatasetEmpty() {
    datasetLoaded = false;
    spinner.hidden = true;
    datasetSheet.textContent = "—";
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
    fileInput.disabled = isLoading;
    clearButton.disabled = isLoading || !datasetLoaded;
    if (isLoading && message) {
      showStatus("info", message);
    }
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

  function renderResults(rows, summary) {
    lastRenderedRows = rows.slice();
    resultsBody.innerHTML = "";

    const query = summary?.query?.trim() ?? "";
    const total = summary?.total ?? 0;

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.className = "empty-state";
      const td = document.createElement("td");
      td.colSpan = 4;

      if (!datasetLoaded) {
        td.textContent = "Upload a workbook to enable search.";
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
      searchSummary.textContent = rows.length ? `Showing ${rows.length} milestone${rows.length === 1 ? "" : "s"}.` : "";
    } else if (total === 0) {
      searchSummary.textContent = "No matches.";
    } else {
      const limitedCount = rows.length;
      const totalText = `${limitedCount} of ${total}`;
      searchSummary.textContent =
        limitedCount === total ? `${limitedCount} match${total === 1 ? "" : "es"}.` : `${totalText} matches.`;
    }
  }

  return {
    renderDatasetReady,
    renderDatasetEmpty,
    enableSearch,
    focusSearch,
    setLoading,
    showStatus,
    renderResults
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
