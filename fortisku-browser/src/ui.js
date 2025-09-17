const STATUS_TIMEOUT_DEFAULT = 4500;

export function initUI(handlers) {
  const fileInput = document.getElementById("file-input");
  const sheetInput = document.getElementById("sheet-input");
  const clearButton = document.getElementById("clear-button");
  const exportAllButton = document.getElementById("export-all-button");
  const exportResultsButton = document.getElementById("export-results-button");
  const searchInput = document.getElementById("search-input");
  const searchSummary = document.getElementById("search-summary");
  const resultsBody = document.getElementById("results-body");
  const spinner = document.getElementById("dataset-spinner");
  const statusEl = document.getElementById("dataset-status");

  const datasetState = document.getElementById("dataset-state");
  const datasetSheet = document.getElementById("dataset-sheet");
  const datasetRows = document.getElementById("dataset-rows");
  const datasetUpdated = document.getElementById("dataset-updated");
  const datasetVersion = document.getElementById("dataset-version");
  const datasetSize = document.getElementById("dataset-size");

  let statusTimeoutId = null;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    const sheetName = sheetInput.value.trim();
    if (file) {
      handlers.onUpload({
        file,
        sheetName: sheetName || undefined
      });
    }
    fileInput.value = "";
  });

  clearButton.addEventListener("click", () => {
    const confirmed = window.confirm("Clear the stored dataset? You will need to re-upload the workbook.");
    if (confirmed) {
      handlers.onClear();
    }
  });

  exportAllButton.addEventListener("click", handlers.onExportAll);
  exportResultsButton.addEventListener("click", handlers.onExportResults);

  const debouncedSearch = debounce((value) => handlers.onSearch(value), 150);
  searchInput.addEventListener("input", (event) => {
    debouncedSearch(event.target.value);
  });

  resultsBody.addEventListener("click", async (event) => {
    const button = event.target.closest(".copy-btn");
    if (!button) return;

    if (button.disabled) {
      return;
    }

    const value = button.dataset.copyValue || "";
    const label = button.dataset.copyLabel || "value";

    try {
      await navigator.clipboard.writeText(value);
      showStatus("success", `${label} copied to clipboard.`, { dismissAfter: 2000 });
    } catch (error) {
      console.warn("Clipboard write failed", error);
      showStatus("warn", "Unable to access the clipboard. Copy manually.", { dismissAfter: 2500 });
    }
  });

  function renderDatasetReady(meta, storedBytes) {
    datasetState.textContent = "Ready";
    datasetSheet.textContent = meta.sheetName || "Unknown";
    datasetRows.textContent = meta.rowCount?.toLocaleString() ?? "0";
    datasetUpdated.textContent = meta.updatedAt ? formatDate(meta.updatedAt) : "—";
    datasetVersion.textContent = meta.schemaVersion || "—";
    datasetSize.textContent = formatBytes(storedBytes ?? meta.storedBytes ?? 0);
    exportAllButton.disabled = false;
  }

  function renderDatasetEmpty() {
    datasetState.textContent = "Empty";
    datasetSheet.textContent = "—";
    datasetRows.textContent = "0";
    datasetUpdated.textContent = "—";
    datasetVersion.textContent = "—";
    datasetSize.textContent = "0 B";
    exportAllButton.disabled = true;
    exportResultsButton.disabled = true;
    searchInput.value = "";
    searchSummary.textContent = "";
    renderResults([], { total: 0, limited: false, query: "" });
  }

  function renderResults(rows, summary) {
    resultsBody.innerHTML = "";

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.className = "empty-state";
      const td = document.createElement("td");
      td.colSpan = 8;
      td.textContent = summary.query ? "No results match your search." : "Upload a workbook to begin.";
      tr.appendChild(td);
      resultsBody.appendChild(tr);
      exportResultsButton.disabled = true;
      updateSummary(summary, 0);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement("tr");

      tr.appendChild(buildSkuCell(row.sku));
      tr.appendChild(buildTextCell(row.description));
      tr.appendChild(buildPriceCell(row.price));
      tr.appendChild(buildTextCell(row.family));
      tr.appendChild(buildTextCell(row.model));
      tr.appendChild(buildTextCell(row.bundle));
      tr.appendChild(buildTextCell(row.term));
      tr.appendChild(buildTextCell(row.version_date));

      fragment.appendChild(tr);
    }

    resultsBody.appendChild(fragment);
    exportResultsButton.disabled = false;
    updateSummary(summary, rows.length);
  }

  function buildSkuCell(sku) {
    const td = document.createElement("td");
    const wrapper = document.createElement("div");
    wrapper.className = "sku-cell";
    const text = document.createElement("span");
    text.textContent = sku || "";
    wrapper.appendChild(text);

    if (sku) {
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-btn";
      copyBtn.dataset.copyValue = sku;
      copyBtn.dataset.copyLabel = "SKU";
      copyBtn.textContent = "Copy";
      wrapper.appendChild(copyBtn);
    }

    td.appendChild(wrapper);
    return td;
  }

  function buildPriceCell(price) {
    const td = document.createElement("td");
    const wrapper = document.createElement("div");
    wrapper.className = "sku-cell";

    const formatted = formatPrice(price);
    const text = document.createElement("span");
    text.textContent = formatted;
    wrapper.appendChild(text);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.dataset.copyLabel = "Price";
    copyBtn.disabled = formatted === "";
    copyBtn.dataset.copyValue = formatted;

    wrapper.appendChild(copyBtn);
    td.appendChild(wrapper);
    return td;
  }

  function buildTextCell(value) {
    const td = document.createElement("td");
    td.textContent = value || "";
    return td;
  }

  function updateSummary({ total, limited, query }, displayed) {
    if (!total) {
      searchSummary.textContent = query ? `0 results for “${query.trim()}”` : "";
      return;
    }

    if (limited) {
      searchSummary.textContent = `Showing ${displayed} of ${total.toLocaleString()} results (limited to 200 rows).`;
    } else {
      searchSummary.textContent = `Showing ${displayed.toLocaleString()} of ${total.toLocaleString()} results.`;
    }
  }

  function enableSearch(enabled) {
    searchInput.disabled = !enabled;
    exportResultsButton.disabled = !enabled;
  }

  function focusSearch() {
    if (!searchInput.disabled) {
      searchInput.focus();
    }
  }

  function setLoading(isLoading, message) {
    spinner.hidden = !isLoading;
    spinner.textContent = message || "Processing workbook…";
    fileInput.disabled = isLoading;
    sheetInput.disabled = isLoading;
    clearButton.disabled = isLoading;
    exportAllButton.disabled = isLoading;
  }

  function showStatus(type, message, { dismissAfter } = {}) {
    if (!message) {
      statusEl.textContent = "";
      statusEl.className = "status-message info";
      return;
    }

    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;

    if (statusTimeoutId) {
      clearTimeout(statusTimeoutId);
    }

    const timeout = typeof dismissAfter === "number" ? dismissAfter : STATUS_TIMEOUT_DEFAULT;
    if (timeout > 0) {
      statusTimeoutId = setTimeout(() => {
        statusEl.textContent = "";
        statusEl.className = "status-message info";
      }, timeout);
    }
  }

  return {
    renderDatasetReady,
    renderDatasetEmpty,
    renderResults,
    enableSearch,
    focusSearch,
    setLoading,
    showStatus,
    triggerDownload: downloadBlob
  };
}

function formatPrice(price) {
  if (price === null || price === undefined || Number.isNaN(price)) {
    return "";
  }
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) {
    return String(price);
  }
  return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function downloadBlob(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function debounce(fn, delay) {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
