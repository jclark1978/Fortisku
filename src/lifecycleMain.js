import { ingestLifecycleWorkbook } from "./lifecycleIngest.js";
import {
  createLifecycleSearchIndex,
  loadLifecycleSearchIndex,
  searchLifecycleRows
} from "./lifecycleSearch.js";
import {
  clearLifecyclePersisted,
  estimateLifecycleSizeBytes,
  loadLifecyclePersisted,
  saveLifecyclePersisted
} from "./lifecycleStorage.js";
import { initLifecycleUI } from "./lifecycleUi.js";

const MAX_RENDERED_ROWS = 200;

let rows = [];
let rowsById = new Map();
let miniSearch = null;
let meta = null;

const ui = initLifecycleUI({
  onUpload: handleUpload,
  onClear: handleClear,
  onSearch: handleSearch
});

bootstrap();

async function bootstrap() {
  try {
    const persisted = await loadLifecyclePersisted();
    if (persisted) {
      ({ rows } = persisted);
      rowsById = new Map(rows.map((row) => [row.id, row]));
      miniSearch = loadLifecycleSearchIndex(persisted.indexJSON);
      meta = persisted.meta;
      const storedBytes = meta?.storedBytes ?? estimateLifecycleSizeBytes(rows, persisted.indexJSON);
      ui.renderDatasetReady(meta, storedBytes);
      ui.enableSearch(true);
      ui.renderResults([], { total: rows.length, query: "", rowCount: rows.length });
      ui.showStatus(
        "success",
        `Loaded ${rows.length} row${rows.length === 1 ? "" : "s"} from “${meta.sheetName || "dataset"}”.`,
        { dismissAfter: 3200 }
      );
    } else {
      ui.renderDatasetEmpty();
    }
  } catch (error) {
    console.error("Failed to restore LifeCycle data", error);
    ui.renderDatasetEmpty();
    ui.showStatus("error", error.message || "Failed to load stored LifeCycle data.");
  }
}

async function handleUpload({ file }) {
  if (!file) {
    return;
  }

  ui.setLoading(true, "Processing workbook…");
  try {
    const result = await ingestLifecycleWorkbook(file);
    rows = result.rows;
    rowsById = new Map(rows.map((row) => [row.id, row]));

    const { index, exported } = createLifecycleSearchIndex(rows);
    miniSearch = index;

    meta = {
      updatedAt: new Date().toISOString(),
      rowCount: rows.length,
      sheetName: result.sheetName,
      skippedRows: result.stats.skippedRows
    };

    const storedBytes = estimateLifecycleSizeBytes(rows, exported);
    meta.storedBytes = storedBytes;
    await saveLifecyclePersisted(rows, exported, meta);

    ui.renderDatasetReady(meta, storedBytes);
    ui.enableSearch(true);
    ui.showStatus(
      "success",
      buildUploadMessage(rows.length, result.sheetName, result.stats.skippedRows),
      { dismissAfter: 4500 }
    );
    ui.focusSearch();
    ui.renderResults([], { total: rows.length, query: "", rowCount: rows.length });
  } catch (error) {
    console.error("Failed to ingest LifeCycle workbook", error);
    ui.showStatus("error", error.message || "Failed to process LifeCycle workbook.");
  } finally {
    ui.setLoading(false);
  }
}

async function handleClear() {
  if (!rows.length && !miniSearch) {
    ui.showStatus("info", "LifeCycle store is already empty.");
    return;
  }

  await clearLifecyclePersisted();
  rows = [];
  rowsById = new Map();
  miniSearch = null;
  meta = null;

  ui.renderDatasetEmpty();
  ui.enableSearch(false);
  ui.showStatus("success", "Cleared stored LifeCycle dataset.");
}

function handleSearch(query) {
  if (!rows.length || !miniSearch) {
    ui.renderResults([], { total: 0, query, rowCount: rows.length });
    return;
  }

  const { hits, total } = searchLifecycleRows(miniSearch, rowsById, query, MAX_RENDERED_ROWS);
  ui.renderResults(hits, {
    total,
    query,
    rowCount: rows.length
  });
}

function buildUploadMessage(count, sheetName, skippedRows) {
  let message = `Loaded ${count} row${count === 1 ? "" : "s"} from “${sheetName}”.`;
  if (skippedRows) {
    message += ` Skipped ${skippedRows} incomplete row${skippedRows === 1 ? "" : "s"}.`;
  }
  return message;
}
