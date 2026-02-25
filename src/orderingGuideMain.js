import { ingestWorkbook } from "./ingest.js";
import { createSearchIndex } from "./search.js";
import {
  clearPersisted,
  estimateSizeBytes,
  loadOrderingGuideRows,
  loadPersisted,
  saveOrderingGuideRows,
  savePersisted,
  SCHEMA_VERSION
} from "./storage.js";
import { initOrderingGuideUI } from "./orderingGuideUi.js";
import { initThemeToggle } from "./theme.js";

let allRows = [];

const ui = initOrderingGuideUI({
  onSearch: handleSearch,
  onUpload: handleUpload,
  onClear: handleClear
});

initThemeToggle();
bootstrap();

async function bootstrap() {
  try {
    const [persisted, orderingRows] = await Promise.all([loadPersisted(), loadOrderingGuideRows()]);
    allRows = Array.isArray(orderingRows) ? orderingRows : [];
    ui.setDataset(persisted?.meta || null, allRows.length, !!persisted);
    ui.renderRows(allRows, { query: "", total: allRows.length, datasetLoaded: !!persisted });

    if (!persisted) {
      ui.showStatus("info", "Upload a pricelist to populate Ordering Guide data.", { dismissAfter: 4200 });
    }
  } catch (error) {
    console.error("Failed to load ordering guide data", error);
    ui.setDataset(null, 0, false);
    ui.renderRows([], { query: "", total: 0, datasetLoaded: false });
    ui.showStatus("error", error.message || "Failed to load stored ordering guide data.");
  }
}

async function handleUpload({ file }) {
  if (!file) {
    return;
  }

  ui.setLoading(true);
  try {
    const result = await ingestWorkbook(file);
    const { exported } = createSearchIndex(result.rows);

    const meta = {
      updatedAt: new Date().toISOString(),
      rowCount: result.rows.length,
      schemaVersion: SCHEMA_VERSION,
      sheetName: result.sheetName,
      skippedRows: result.stats.skippedRows,
      priceListLabel: result.coverInfo || null
    };
    meta.storedBytes = estimateSizeBytes(result.rows, exported);

    allRows = Array.isArray(result.orderingGuideRows) ? result.orderingGuideRows : [];

    await savePersisted(result.rows, exported, meta);
    await saveOrderingGuideRows(allRows);

    ui.setDataset(meta, allRows.length, true);
    ui.renderRows(allRows, { query: "", total: allRows.length, datasetLoaded: true });

    let message = `Loaded ${result.rows.length} rows from “${result.sheetName}”.`;
    if (result.stats.skippedRows) {
      message += ` Skipped ${result.stats.skippedRows} row(s) missing required fields.`;
    }
    message += ` Ordering Guides rows: ${allRows.length}.`;
    ui.showStatus("success", message);
  } catch (error) {
    console.error("Failed to process workbook on Ordering Guides page", error);
    ui.showStatus("error", error.message || "Failed to process workbook.");
  } finally {
    ui.setLoading(false);
  }
}

async function handleClear() {
  await clearPersisted();
  allRows = [];
  ui.setDataset(null, 0, false);
  ui.renderRows([], { query: "", total: 0, datasetLoaded: false });
  ui.showStatus("success", "Cleared stored dataset.");
}

function handleSearch(query) {
  const searchText = String(query || "").trim().toLowerCase();
  if (!searchText) {
    ui.renderRows(allRows, { query: "", total: allRows.length, datasetLoaded: true });
    return;
  }

  const filtered = allRows.filter((row) => {
    const left = (row.orderingGuide || "").toLowerCase();
    const right = (row.relatedProducts || "").toLowerCase();
    return left.includes(searchText) || right.includes(searchText);
  });

  ui.renderRows(filtered, {
    query: query.trim(),
    total: allRows.length,
    datasetLoaded: true
  });
}
