const STATUS_TIMEOUT_DEFAULT = 4500;

export function initOrderingGuideUI(handlers) {
  const fileInput = document.getElementById("og-file-input");
  const clearButton = document.getElementById("og-clear-button");
  const searchInput = document.getElementById("og-search-input");
  const searchSummary = document.getElementById("og-search-summary");
  const resultsBody = document.getElementById("og-results-body");
  const spinner = document.getElementById("og-dataset-spinner");
  const datasetUploadState = document.getElementById("og-dataset-upload-state");
  const datasetPricelist = document.getElementById("og-dataset-pricelist");
  const datasetState = document.getElementById("og-dataset-state");
  const datasetRows = document.getElementById("og-dataset-rows");
  const datasetUpdated = document.getElementById("og-dataset-updated");
  const datasetSize = document.getElementById("og-dataset-size");
  const statusEl = document.getElementById("og-status");

  let statusTimeoutId = null;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) {
      handlers.onUpload({ file });
    }
    fileInput.value = "";
  });

  clearButton.addEventListener("click", () => {
    const confirmed = window.confirm("Clear the stored dataset? You will need to re-upload the workbook.");
    if (confirmed) {
      handlers.onClear();
    }
  });

  const debouncedSearch = debounce((value) => handlers.onSearch(value), 120);
  searchInput.addEventListener("input", (event) => {
    debouncedSearch(event.target.value);
  });

  function setDataset(meta, rowCount, datasetLoaded = rowCount > 0) {
    datasetState.textContent = datasetLoaded ? "Ready" : "Empty";
    datasetRows.textContent = rowCount.toLocaleString();
    datasetUpdated.textContent = meta?.updatedAt ? formatDate(meta.updatedAt) : "—";
    datasetPricelist.textContent = meta?.priceListLabel || "—";
    datasetSize.textContent = formatBytes(meta?.storedBytes ?? 0);
    searchInput.disabled = !datasetLoaded;
    clearButton.disabled = !datasetLoaded;
    datasetUploadState.textContent = datasetLoaded ? "Pricelist uploaded" : "No pricelist uploaded";
    spinner.hidden = true;
  }

  function setLoading(isLoading) {
    spinner.hidden = !isLoading;
    if (isLoading) {
      datasetUploadState.textContent = "Uploading pricelist…";
    } else {
      datasetUploadState.textContent = datasetState.textContent === "Ready" ? "Pricelist uploaded" : "No pricelist uploaded";
    }
    fileInput.disabled = isLoading;
    clearButton.disabled = isLoading || datasetState.textContent !== "Ready";
  }

  function renderRows(rows, { query, total, datasetLoaded }) {
    resultsBody.innerHTML = "";

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.className = "empty-state";
      const td = document.createElement("td");
      td.colSpan = 2;
      if (!datasetLoaded) {
        td.textContent = "Upload a pricelist to populate Ordering Guide data.";
      } else if (query) {
        td.textContent = "No rows match your search.";
      } else {
        td.textContent = "No ordering guide entries available.";
      }
      tr.appendChild(td);
      resultsBody.appendChild(tr);
      searchSummary.textContent = query ? `0 matches for “${query}”` : "";
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement("tr");

      const orderingCell = document.createElement("td");
      const orderingLink = buildLink(row.orderingGuideUrl || row.orderingGuide);
      if (orderingLink) {
        orderingLink.textContent = row.orderingGuide;
        orderingCell.appendChild(orderingLink);
      } else {
        orderingCell.textContent = row.orderingGuide;
      }
      tr.appendChild(orderingCell);

      const relatedCell = document.createElement("td");
      const link = buildLink(row.relatedProductsUrl || row.relatedProducts);
      if (link) {
        relatedCell.appendChild(link);
      } else {
        relatedCell.textContent = row.relatedProducts;
      }
      tr.appendChild(relatedCell);

      fragment.appendChild(tr);
    }

    resultsBody.appendChild(fragment);
    searchSummary.textContent = `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} rows.`;
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
        statusEl.className = "status-message info";
      }, dismissAfter);
    }
  }

  return {
    setDataset,
    setLoading,
    renderRows,
    showStatus
  };
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

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function buildLink(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  const hasProtocol = /^https?:\/\//i.test(value);
  const startsWithWww = /^www\./i.test(value);
  if (!hasProtocol && !startsWithWww) return null;

  const href = hasProtocol ? value : `https://${value}`;
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.textContent = value;
  return anchor;
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
