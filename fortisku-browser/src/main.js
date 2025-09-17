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

const MAX_RENDERED_ROWS = 200;

let rows = [];
let rowsById = new Map();
let miniSearch = null;
let meta = null;
let currentResults = [];

const ui = initUI({
  onUpload: handleUpload,
  onClear: handleClear,
  onSearch: handleSearch,
  onExportAll: handleExportAll,
  onExportResults: handleExportResults
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
