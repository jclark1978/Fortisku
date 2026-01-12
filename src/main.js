import { ingestWorkbook } from "./ingest.js";
import { createSearchIndex, loadSearchIndex, searchRows, parseQuery } from "./search.js";
import {
  loadPersisted,
  savePersisted,
  clearPersisted,
  estimateSizeBytes,
  SCHEMA_VERSION
} from "./storage.js";
import { initUI } from "./ui.js";
import { rowsToCSV } from "./csv.js";
import {
  initBOM,
  subscribe as subscribeBOM,
  addOrIncrement as bomAdd,
  updateItem as bomUpdate,
  removeItem as bomRemove,
  clearBOM
} from "./bom.js";
import { exportBomToCsv } from "./bomExport.js";

const MAX_RENDERED_ROWS = 200;

let rows = [];
let rowsById = new Map();
let miniSearch = null;
let meta = null;
let currentResults = [];
let bomState = { items: [], totals: { itemCount: 0, totalQuantity: 0, listTotal: 0, discountedTotal: 0 } };

const ui = initUI({
  onUpload: handleUpload,
  onClear: handleClear,
  onSearch: handleSearch,
  onExportAll: handleExportAll,
  onExportResults: handleExportResults,
  onAddToBom: handleAddToBom,
  onRemoveFromBom: handleRemoveFromBom,
  onBomQuantityChange: handleBomQuantityChange,
  onBomDiscountChange: handleBomDiscountChange,
  onExportBom: handleExportBom,
  onClearBom: handleClearBom
});

bootstrap();

async function bootstrap() {
  try {
    const persisted = await loadPersisted();
    if (persisted) {
      ({ rows } = persisted);
      rowsById = new Map(rows.map((row) => [row.id, row]));
      miniSearch = loadSearchIndex(persisted.indexJSON);
      meta = persisted.meta;
      const storedBytes = meta?.storedBytes ?? estimateSizeBytes(rows, persisted.indexJSON);
      ui.renderDatasetReady(meta, storedBytes);
      ui.enableSearch(true);
      ui.renderResults(
        rows.slice(0, MAX_RENDERED_ROWS),
        {
          total: rows.length,
          limited: rows.length > MAX_RENDERED_ROWS,
          query: ""
        }
      );
      currentResults = rows.slice(0, MAX_RENDERED_ROWS);
      ui.focusSearch();
    } else {
      ui.renderDatasetEmpty();
    }
  } catch (error) {
    console.error(error);
    ui.renderDatasetEmpty();
    ui.showStatus("error", `IndexedDB is unavailable: ${error.message}`);
  }

  try {
    const initialBom = await initBOM();
    bomState = initialBom;
    ui.setBomState(initialBom);
    subscribeBOM((state) => {
      bomState = state;
      ui.setBomState(state);
    });
  } catch (error) {
    console.error("Failed to initialize BOM", error);
  }

  registerServiceWorker();
}

async function handleUpload({ file, sheetName }) {
  if (!file) {
    return;
  }

  ui.setLoading(true, "Processing workbook…");
  try {
    const result = await ingestWorkbook(file, sheetName);
    rows = result.rows;
    rowsById = new Map(rows.map((row) => [row.id, row]));

    const { index, exported } = createSearchIndex(rows);
    miniSearch = index;

    meta = {
      updatedAt: new Date().toISOString(),
      rowCount: rows.length,
      schemaVersion: SCHEMA_VERSION,
      sheetName: result.sheetName,
      skippedRows: result.stats.skippedRows,
      priceListLabel: result.coverInfo || null
    };

    const storedBytes = estimateSizeBytes(rows, exported);
    meta.storedBytes = storedBytes;
    await savePersisted(rows, exported, meta);

    ui.renderDatasetReady(meta, storedBytes);
    ui.enableSearch(true);

    currentResults = rows.slice(0, MAX_RENDERED_ROWS);
    ui.renderResults(
      currentResults,
      {
        total: rows.length,
        limited: rows.length > MAX_RENDERED_ROWS,
        query: ""
      }
    );

    let message = `Loaded ${rows.length} rows from “${result.sheetName}”.`;
    if (result.stats.skippedRows) {
      message += ` Skipped ${result.stats.skippedRows} row(s) missing required fields.`;
    }
    ui.showStatus("success", message);
    ui.focusSearch();
  } catch (error) {
    console.error(error);
    ui.showStatus("error", error.message || "Failed to process workbook.");
  } finally {
    ui.setLoading(false);
  }
}

async function handleClear() {
  if (!rows.length && !miniSearch) {
    ui.showStatus("info", "Store is already empty.");
    return;
  }

  await clearPersisted();
  rows = [];
  rowsById = new Map();
  miniSearch = null;
  meta = null;
  currentResults = [];

  ui.renderDatasetEmpty();
  ui.renderResults([], { total: 0, limited: false, query: "" });
  ui.enableSearch(false);
  ui.showStatus("success", "Cleared stored dataset.");
}

function handleSearch(query) {
  if (!rows.length) {
    ui.renderResults([], { total: 0, limited: false, query });
    return;
  }

  const parsed = parseQuery(query);
  if (!parsed.groups.length) {
    currentResults = rows.slice(0, MAX_RENDERED_ROWS);
    ui.renderResults(currentResults, {
      total: rows.length,
      limited: rows.length > MAX_RENDERED_ROWS,
      query: ""
    });
    return;
  }

  const { hits, total } = searchRows(miniSearch, rowsById, parsed, MAX_RENDERED_ROWS);
  currentResults = hits;
  ui.renderResults(hits, {
    total,
    limited: total > MAX_RENDERED_ROWS,
    query
  });
}

function handleExportAll() {
  if (!rows.length) {
    ui.showStatus("warn", "No dataset to export.");
    return;
  }
  const csv = rowsToCSV(rows);
  const filename = buildCsvFilename("dataset");
  ui.triggerDownload(filename, csv);
  ui.showStatus("success", "Exported full dataset to CSV.", { dismissAfter: 3000 });
}

function handleExportResults() {
  if (!currentResults.length) {
    ui.showStatus("warn", "No results to export.");
    return;
  }
  const csv = rowsToCSV(currentResults);
  const filename = buildCsvFilename("results");
  ui.triggerDownload(filename, csv);
  ui.showStatus("success", "Exported current results to CSV.", { dismissAfter: 3000 });
}

function buildCsvFilename(suffix) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
  return `fortisku-${suffix}-${timestamp}.csv`;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) => console.warn("Service worker registration failed:", error));
  }
}

async function handleAddToBom(rowId, quantity) {
  const row = rowsById.get(rowId);
  if (!row) {
    ui.showStatus("warn", "Item is no longer available in the dataset.");
    return;
  }
  const wasEmpty = bomState.items.length === 0;
  await bomAdd(row, { quantity });
  if (wasEmpty) {
    ui.openBomDrawer();
  }
  ui.showStatus("success", `Added ${row.sku} × ${quantity} to list.`, { dismissAfter: 2500 });
}

async function handleRemoveFromBom(rowId) {
  const row = rowsById.get(rowId);
  await bomRemove(rowId);
  ui.showStatus("success", `Removed ${row?.sku ?? "item"} from list.`, { dismissAfter: 2500 });
}

async function handleBomQuantityChange(rowId, quantity) {
  await bomUpdate(rowId, { quantity });
}

async function handleBomDiscountChange(rowId, discountPercent) {
  await bomUpdate(rowId, { discountPercent });
}

async function handleClearBom() {
  await clearBOM();
  ui.showStatus("success", "Cleared BOM list.", { dismissAfter: 2500 });
}

async function handleExportBom() {
  if (!bomState.items.length) {
    ui.showStatus("info", "Add items to the list before exporting.");
    return;
  }
  try {
    exportBomToCsv(bomState);
  } catch (error) {
    console.error("Failed to export BOM", error);
    ui.showStatus("error", "Unable to export the list. Try again.");
  }
}
