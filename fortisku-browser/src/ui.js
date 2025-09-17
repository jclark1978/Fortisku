const STATUS_TIMEOUT_DEFAULT = 4500;

const DISPLAY_HEADERS = [
  { key: "sku", label: "SKU" },
  { key: "description", label: "Description #1" },
  { key: "description2", label: "Description #2" },
  { key: "price", label: "Price" },
  { key: "category", label: "Category" }
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const quantityFormatter = new Intl.NumberFormat("en-US", {
  style: "decimal",
  maximumFractionDigits: 0
});

export function initUI(handlers) {
  const onAddToBom = handlers.onAddToBom || (() => {});
  const onRemoveFromBom = handlers.onRemoveFromBom || (() => {});
  const onBomQuantityChange = handlers.onBomQuantityChange || (() => {});
  const onBomDiscountChange = handlers.onBomDiscountChange || (() => {});
  const onExportBom = handlers.onExportBom || (() => {});
  const onClearBom = handlers.onClearBom || (() => {});

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

  const bomToggleButton = document.getElementById("bom-toggle");
  const bomDrawer = document.getElementById("bom-drawer");
  const bomOverlay = document.getElementById("bom-overlay");
  const bomCloseButton = document.getElementById("bom-close");
  const bomRows = document.getElementById("bom-rows");
  const bomEmptyState = document.getElementById("bom-empty");
  const bomTable = document.getElementById("bom-table");
  const bomSummary = document.getElementById("bom-summary");
  const bomCount = document.getElementById("bom-count");
  const bomExportButton = document.getElementById("bom-export");
  const bomOpenButton = document.getElementById("bom-open");
  const bomClearButton = document.getElementById("bom-clear");

  const bomModal = document.getElementById("bom-modal");
  const bomModalClose = document.getElementById("bom-modal-close");
  const bomModalRows = document.getElementById("bom-modal-rows");
  const bomModalSummary = document.getElementById("bom-modal-summary");
  const bomModalExport = document.getElementById("bom-modal-export");
  const bomModalClear = document.getElementById("bom-modal-clear");

  let statusTimeoutId = null;
  let lastRenderedRows = [];
  let lastRenderedSummary = null;
  let bomState = { items: [], totals: { itemCount: 0, totalQuantity: 0, listTotal: 0, discountedTotal: 0 } };
  let bomLookup = new Map();
  let drawerOpen = false;
  let modalOpen = false;

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

  exportAllButton.addEventListener("click", handlers.onExportAll);
  exportResultsButton.addEventListener("click", handlers.onExportResults);

  const debouncedSearch = debounce((value) => handlers.onSearch(value), 150);
  searchInput.addEventListener("input", (event) => {
    debouncedSearch(event.target.value);
  });

  resultsBody.addEventListener("click", async (event) => {
    const copyBtn = event.target.closest(".copy-btn");
    if (copyBtn) {
      event.preventDefault();
      const rowIndex = Number(copyBtn.dataset.rowIndex ?? "-1");
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
      return;
    }

    const toggleBtn = event.target.closest(".bom-toggle-btn");
    if (toggleBtn) {
      const rowId = toggleBtn.dataset.rowId;
      const isInList = bomLookup.has(rowId);
      if (!isInList) {
        const defaultQuantity = bomLookup.get(rowId)?.quantity ?? 1;
        const quantity = promptForQuantity(defaultQuantity);
        if (quantity == null) {
          return;
        }
        onAddToBom(rowId, quantity);
      } else {
        onRemoveFromBom(rowId);
      }
    }
  });

  bomToggleButton.addEventListener("click", () => {
    if (drawerOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  bomCloseButton.addEventListener("click", () => {
    closeDrawer();
  });

  bomOverlay.addEventListener("click", () => {
    if (modalOpen) {
      closeModal();
    } else if (drawerOpen) {
      closeDrawer();
    }
  });

  bomExportButton.addEventListener("click", () => onExportBom());
  bomModalExport.addEventListener("click", () => onExportBom());

  bomClearButton.addEventListener("click", () => {
    if (!bomState.items.length) return;
    const confirmed = window.confirm("Clear all items from the list?");
    if (confirmed) {
      onClearBom();
    }
  });

  bomModalClear.addEventListener("click", () => {
    if (!bomState.items.length) return;
    const confirmed = window.confirm("Clear all items from the list?");
    if (confirmed) {
      onClearBom();
    }
  });

  bomOpenButton.addEventListener("click", () => {
    openModal();
  });

  bomModalClose.addEventListener("click", () => {
    closeModal();
  });

  bomRows.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("[data-role=quantity]")) {
      const rowId = target.dataset.rowId;
      const value = Number(target.value);
      onBomQuantityChange(rowId, value);
    }
  });

  bomRows.addEventListener("click", (event) => {
    const trash = event.target.closest(".trash-button");
    if (trash) {
      const rowId = trash.dataset.rowId;
      onRemoveFromBom(rowId);
    }
  });

  bomModalRows.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("[data-role=quantity]") ) {
      const rowId = target.dataset.rowId;
      const value = Number(target.value);
      onBomQuantityChange(rowId, value);
    }
    if (target.matches("[data-role=discount]")) {
      const rowId = target.dataset.rowId;
      const value = Number(target.value);
      onBomDiscountChange(rowId, value);
    }
  });

  bomModalRows.addEventListener("click", (event) => {
    const trash = event.target.closest(".trash-button");
    if (trash) {
      const rowId = trash.dataset.rowId;
      onRemoveFromBom(rowId);
    }
  });

  function renderDatasetReady(meta, storedBytes) {
    datasetState.textContent = "Ready";
    datasetRows.textContent = meta.rowCount?.toLocaleString() ?? "0";
    datasetUpdated.textContent = meta.updatedAt ? formatDate(meta.updatedAt) : "—";
    datasetPricelist.textContent = meta.priceListLabel || "—";
    datasetSize.textContent = formatBytes(storedBytes ?? meta.storedBytes ?? 0);
    exportAllButton.disabled = false;
    if (bomState.items.length) {
      bomToggleButton.hidden = false;
    }
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
    bomToggleButton.hidden = true;
    closeDrawer();
    closeModal();
  }

  function renderResults(rows, summary) {
    lastRenderedRows = rows.slice();
    lastRenderedSummary = summary;

    resultsBody.innerHTML = "";

    if (!rows.length) {
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

    const commentText = (row.comments || "").trim();
    if (commentText) {
      const badge = document.createElement("span");
      badge.className = "comment-indicator";
      badge.textContent = "!";
      badge.setAttribute("role", "note");
      badge.setAttribute("aria-label", "Comments available");
      badge.title = commentText;
      wrapper.appendChild(badge);
    }

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-btn";
    copyBtn.dataset.rowIndex = String(index);
    copyBtn.textContent = "Copy";
    wrapper.appendChild(copyBtn);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "icon-button bom-toggle-btn";
    toggleBtn.dataset.rowId = row.id;
    const isInList = bomLookup.has(row.id);
    toggleBtn.classList.toggle("remove", isInList);
    toggleBtn.textContent = isInList ? "–" : "+";
    toggleBtn.setAttribute("aria-label", isInList ? `Remove ${row.sku} from list` : `Add ${row.sku} to list`);
    wrapper.appendChild(toggleBtn);

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
    if (!enabled) {
      bomToggleButton.hidden = true;
    } else if (bomState.items.length) {
      bomToggleButton.hidden = false;
    }
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

  function setBomState(state) {
    bomState = state;
    bomLookup = new Map(state.items.map((item) => [item.id, item]));
    updateBomToggle();
    renderBomDrawer();
    renderBomModal();
    if (lastRenderedRows.length) {
      renderResults(lastRenderedRows, lastRenderedSummary);
    }
  }

  function updateBomToggle() {
    const count = bomState.items.length;
    bomCount.textContent = String(count);
    if (count === 0) {
      bomToggleButton.hidden = true;
      closeDrawer();
      closeModal();
    } else {
      bomToggleButton.hidden = false;
    }
  }

  function renderBomDrawer() {
    const items = bomState.items;
    if (!items.length) {
      bomEmptyState.hidden = false;
      bomTable.hidden = true;
      bomSummary.textContent = "";
      return;
    }

    bomEmptyState.hidden = true;
    bomTable.hidden = false;
    bomRows.innerHTML = "";

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const tr = document.createElement("tr");

      const skuCell = document.createElement("td");
      skuCell.innerHTML = `<strong>${escapeHtml(item.sku)}</strong>`;
      tr.appendChild(skuCell);

      const descCell = document.createElement("td");
      descCell.textContent = item.description || item.description2 || "";
      tr.appendChild(descCell);

      const qtyCell = document.createElement("td");
      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "1";
      qtyInput.step = "1";
      qtyInput.value = item.quantity;
      qtyInput.className = "quantity-input";
      qtyInput.dataset.rowId = item.id;
      qtyInput.dataset.role = "quantity";
      qtyCell.appendChild(qtyInput);
      tr.appendChild(qtyCell);

      const discountCell = document.createElement("td");
      discountCell.className = "discount-display";
      discountCell.textContent = `${item.discountPercent.toFixed(2)}%`;
      tr.appendChild(discountCell);

      const unitCell = document.createElement("td");
      unitCell.textContent = currencyFormatter.format(item.price);
      tr.appendChild(unitCell);

      const totalCell = document.createElement("td");
      totalCell.textContent = currencyFormatter.format(item.price * item.quantity);
      tr.appendChild(totalCell);

      const discountedCell = document.createElement("td");
      const discounted = item.price * item.quantity * (1 - item.discountPercent / 100);
      discountedCell.textContent = currencyFormatter.format(discounted);
      tr.appendChild(discountedCell);

      const actionsCell = document.createElement("td");
      const trash = document.createElement("button");
      trash.type = "button";
      trash.dataset.rowId = item.id;
      trash.className = "trash-button";
      trash.innerHTML = "🗑";
      actionsCell.appendChild(trash);
      tr.appendChild(actionsCell);

      fragment.appendChild(tr);
    });

    bomRows.appendChild(fragment);

    bomSummary.innerHTML = `
      <div><strong>Items:</strong> ${quantityFormatter.format(bomState.totals.itemCount)}</div>
      <div><strong>Qty:</strong> ${quantityFormatter.format(bomState.totals.totalQuantity)}</div>
      <div><strong>List Total:</strong> ${currencyFormatter.format(bomState.totals.listTotal)}</div>
      <div><strong>Discounted:</strong> ${currencyFormatter.format(bomState.totals.discountedTotal)}</div>
    `;
  }

  function renderBomModal() {
    const items = bomState.items;
    if (!modalOpen) {
      bomModalSummary.innerHTML = `
        <div><strong>Items:</strong> ${quantityFormatter.format(bomState.totals.itemCount)}</div>
        <div><strong>Qty:</strong> ${quantityFormatter.format(bomState.totals.totalQuantity)}</div>
        <div><strong>List Total:</strong> ${currencyFormatter.format(bomState.totals.listTotal)}</div>
        <div><strong>Discounted:</strong> ${currencyFormatter.format(bomState.totals.discountedTotal)}</div>
      `;
      return;
    }

    bomModalRows.innerHTML = "";
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const tr = document.createElement("tr");

      const skuCell = document.createElement("td");
      skuCell.innerHTML = `<strong>${escapeHtml(item.sku)}</strong>`;
      tr.appendChild(skuCell);

      const descCell = document.createElement("td");
      descCell.textContent = item.description || item.description2 || "";
      tr.appendChild(descCell);

      const qtyCell = document.createElement("td");
      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "1";
      qtyInput.step = "1";
      qtyInput.value = item.quantity;
      qtyInput.className = "quantity-input";
      qtyInput.dataset.rowId = item.id;
      qtyInput.dataset.role = "quantity";
      qtyCell.appendChild(qtyInput);
      tr.appendChild(qtyCell);

      const discountCell = document.createElement("td");
      const discountInput = document.createElement("input");
      discountInput.type = "number";
      discountInput.min = "0";
      discountInput.max = "100";
      discountInput.step = "0.1";
      discountInput.value = item.discountPercent;
      discountInput.className = "discount-input";
      discountInput.dataset.rowId = item.id;
      discountInput.dataset.role = "discount";
      discountCell.appendChild(discountInput);
      tr.appendChild(discountCell);

      const unitCell = document.createElement("td");
      unitCell.textContent = currencyFormatter.format(item.price);
      tr.appendChild(unitCell);

      const totalCell = document.createElement("td");
      totalCell.textContent = currencyFormatter.format(item.price * item.quantity);
      tr.appendChild(totalCell);

      const discountedCell = document.createElement("td");
      const discounted = item.price * item.quantity * (1 - item.discountPercent / 100);
      discountedCell.textContent = currencyFormatter.format(discounted);
      tr.appendChild(discountedCell);

      const actionsCell = document.createElement("td");
      const trash = document.createElement("button");
      trash.type = "button";
      trash.dataset.rowId = item.id;
      trash.className = "trash-button";
      trash.innerHTML = "🗑";
      actionsCell.appendChild(trash);
      tr.appendChild(actionsCell);

      fragment.appendChild(tr);
    });

    bomModalRows.appendChild(fragment);
    bomModalSummary.innerHTML = `
      <div><strong>Items:</strong> ${quantityFormatter.format(bomState.totals.itemCount)}</div>
      <div><strong>Qty:</strong> ${quantityFormatter.format(bomState.totals.totalQuantity)}</div>
      <div><strong>List Total:</strong> ${currencyFormatter.format(bomState.totals.listTotal)}</div>
      <div><strong>Discounted:</strong> ${currencyFormatter.format(bomState.totals.discountedTotal)}</div>
    `;
  }

  function openDrawer() {
    if (!bomState.items.length) return;
    drawerOpen = true;
    bomDrawer.classList.add("open");
    bomToggleButton.setAttribute("aria-expanded", "true");
    updateOverlay();
  }

  function closeDrawer() {
    drawerOpen = false;
    bomDrawer.classList.remove("open");
    bomToggleButton.setAttribute("aria-expanded", "false");
    updateOverlay();
  }

  function openModal() {
    if (!bomState.items.length) return;
    closeDrawer();
    modalOpen = true;
    bomModal.classList.add("open");
    updateOverlay();
    renderBomModal();
  }

  function closeModal() {
    modalOpen = false;
    bomModal.classList.remove("open");
    updateOverlay();
  }

  function updateOverlay() {
    if (drawerOpen || modalOpen) {
      bomOverlay.classList.add("visible");
    } else {
      bomOverlay.classList.remove("visible");
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
    triggerDownload: downloadBlob,
    setBomState,
    openBomDrawer: () => openDrawer()
  };
}

function promptForQuantity(defaultQuantity) {
  const initial = Number(defaultQuantity) || 1;
  const response = window.prompt("Quantity", String(initial));
  if (response === null) return null;
  const parsed = Number(response);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    alert("Please enter a valid quantity (1 or greater).");
    return null;
  }
  return Math.round(parsed);
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

function serializeRowWithHeaders(row) {
  const values = DISPLAY_HEADERS.map(({ key }) => {
    if (key === "price") {
      const formatted = formatPrice(row.price);
      if (formatted) {
        return formatted;
      }
      if (row.price_display) {
        return row.price_display;
      }
      return "";
    }
    return row[key] ? String(row[key]) : "";
  });
  const headerLine = DISPLAY_HEADERS.map((h) => h.label).join("\t");
  const valueLine = values.join("\t");
  return `${headerLine}\n${valueLine}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
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
