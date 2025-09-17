const STATUS_TIMEOUT_DEFAULT = 4500;

const DISPLAY_HEADERS = [
  { key: "sku", label: "SKU" },
  { key: "description", label: "Description #1" },
  { key: "description2", label: "Description #2" },
  { key: "price", label: "Price" },
  { key: "category", label: "Category" }
];

export function initUI(handlers) {
  const fileInput = document.getElementById("file-input");
  const clearButton = document.getElementById("clear-button");
  const exportAllButton = document.getElementById("export-all-button");
  const exportResultsButton = document.getElementById("export-results-button");
  const searchInput = document.getElementById("search-input");
  const searchSummary = document.getElementById("search-summary");
  const resultsBody = document.getElementById("results-body");
  const spinner = document.getElementById("dataset-spinner");
  const statusEl = document.getElementById("dataset-status");

  const datasetState = document.getElementById("dataset-state");
  const datasetRows = document.getElementById("dataset-rows");
  const datasetUpdated = document.getElementById("dataset-updated");
  const datasetPricelist = document.getElementById("dataset-pricelist") || document.getElementById("dataset-version");
  const datasetSize = document.getElementById("dataset-size");

  let statusTimeoutId = null;
  let lastRenderedRows = [];

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) {
      handlers.onUpload({
        file
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

    const rowIndex = Number(button.dataset.rowIndex ?? "-1");
    if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= lastRenderedRows.length) {
      showStatus("warn", "Could not determine which row to copy.");
      return;
    }

    const copyText = serializeRowWithHeaders(lastRenderedRows[rowIndex]);

    try {
      await copyToClipboard(copyText);
      showStatus("success", "Row copied to clipboard.", { dismissAfter: 2000 });
    } catch (error) {
      console.warn("Clipboard write failed", error);
      const message = describeClipboardError(error);
      showStatus("warn", message, { dismissAfter: 4000 });
    }
  });

  function renderDatasetReady(meta, storedBytes) {
    datasetState.textContent = "Ready";
    datasetRows.textContent = meta.rowCount?.toLocaleString() ?? "0";
    datasetUpdated.textContent = meta.updatedAt ? formatDate(meta.updatedAt) : "—";
    datasetPricelist.textContent = meta.priceListLabel || "—";
    datasetSize.textContent = formatBytes(storedBytes ?? meta.storedBytes ?? 0);
    exportAllButton.disabled = false;
  }

  function renderDatasetEmpty() {
    datasetState.textContent = "Empty";
    datasetRows.textContent = "0";
    datasetUpdated.textContent = "—";
    datasetPricelist.textContent = "—";
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
      lastRenderedRows = [];
      const tr = document.createElement("tr");
      tr.className = "empty-state";
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = summary.query ? "No results match your search." : "Upload a workbook to begin.";
      tr.appendChild(td);
      resultsBody.appendChild(tr);
      exportResultsButton.disabled = true;
      updateSummary(summary, 0);
      return;
    }

    lastRenderedRows = rows.slice();

    const fragment = document.createDocumentFragment();
    rows.forEach((row, index) => {
      const tr = document.createElement("tr");

      tr.appendChild(buildSkuCell(row, index));
      tr.appendChild(buildTextCell(row.description));
      tr.appendChild(buildTextCell(row.description2));
      tr.appendChild(buildPriceCell(row.price, row.price_display));
      tr.appendChild(buildTextCell(row.category));

      fragment.appendChild(tr);
    });

    resultsBody.appendChild(fragment);
    exportResultsButton.disabled = false;
    updateSummary(summary, rows.length);
  }

  function buildSkuCell(row, index) {
    const td = document.createElement("td");
    const wrapper = document.createElement("div");
    wrapper.className = "sku-cell";

    const textSpan = document.createElement("span");
    textSpan.textContent = row.sku || "";
    wrapper.appendChild(textSpan);

    let copyBtn = null;
    if (row.sku) {
      copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-btn";
      copyBtn.dataset.rowIndex = String(index);
      copyBtn.textContent = "Copy";
      wrapper.appendChild(copyBtn);
    }

    const commentText = (row.comments || "").trim();
    if (commentText) {
      const badge = document.createElement("span");
      badge.className = "comment-indicator";
      badge.textContent = "!";
      badge.setAttribute("role", "note");
      badge.setAttribute("aria-label", "Comments available");
      badge.title = commentText;
      if (copyBtn) {
        copyBtn.insertAdjacentElement('afterend', badge);
      } else {
        wrapper.appendChild(badge);
      }
    }

    td.appendChild(wrapper);
    return td;
  }

  function buildPriceCell(price, priceDisplay) {
    const td = document.createElement("td");
    const value = formatPrice(price) || priceDisplay || "";
    td.textContent = value;
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

function serializeRowWithHeaders(row) {
  const values = DISPLAY_HEADERS.map(({ key }) => {
    if (key == "price") {
      const formatted = formatPrice(row.price);
      if (formatted) return formatted;
      if (row.price_display) return row.price_display;
      return "";
    }
    return row[key] ? String(row[key]) : "";
  });
  const headerLine = DISPLAY_HEADERS.map((h) => h.label).join("	");
  const valueLine = values.join("	");
  return `${headerLine}
${valueLine}`;
}

async function copyToClipboard(text) {
  let nativeError = null;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      nativeError = error;
    }
  }

  if (tryExecCommandCopy(text)) {
    return;
  }

  if (!window.isSecureContext) {
    throw createClipboardError("insecure-context");
  }

  if (!navigator.clipboard) {
    throw createClipboardError("unsupported");
  }

  if (nativeError && (nativeError.name === "NotAllowedError" || nativeError.name === "SecurityError")) {
    throw createClipboardError("permission-denied", nativeError);
  }

  throw createClipboardError("unknown", nativeError);
}

function tryExecCommandCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }

  document.body.removeChild(textarea);

  if (previousRange && selection) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }

  return copied;
}

function describeClipboardError(error) {
  if (error?.code === "insecure-context") {
    return "Clipboard copy requires serving the app over http://localhost or HTTPS. Start it with `python -m http.server 5173` and reload.";
  }
  if (error?.code === "unsupported") {
    return "This browser does not support programmatic clipboard copy. Use a modern Chrome, Edge, or Safari release.";
  }
  if (error?.code === "permission-denied") {
    return "Clipboard access was blocked. On macOS Safari, open Settings › Websites › Clipboard and set this site to Allow, then retry.";
  }
  return "Unable to access the clipboard. Copy manually.";
}

function createClipboardError(code, cause) {
  const error = new Error("Clipboard copy failed");
  error.name = "ClipboardAccessError";
  error.code = code;
  if (cause) {
    error.cause = cause;
  }
  return error;
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
