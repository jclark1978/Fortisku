import { parseLifecycleRssText } from "./rss.js";
import {
  createLifecycleSearchIndex,
  loadLifecycleSearchIndex,
  searchLifecycleRows
} from "./search.js";
import {
  clearLifecycleRssPersisted,
  estimateLifecycleRssSizeBytes,
  loadLifecycleRssPersisted,
  saveLifecycleRssPersisted
} from "./storage.js";
import { initLifecycleRssUI } from "./ui.js";
import { initThemeToggle } from "../../shared/ui/theme.js";
import { initToolboxNav } from "../../shared/ui/nav.js";

const MAX_RENDERED_ROWS = 200;
const FORTINET_RSS_URL = "https://support.fortinet.com/rss/Hardware.xml";

let rows = [];
let rowsById = new Map();
let miniSearch = null;
let meta = null;

const ui = initLifecycleRssUI({
  onImportText: handleImportText,
  onImportClipboard: handleImportClipboard,
  onOpenFeed: handleOpenFeed,
  onOpenModal: handleOpenModal,
  onClear: handleClear,
  onSearch: handleSearch
});

initToolboxNav({ current: "hardware-lifecycle", basePath: "../" });
initThemeToggle();
bootstrap();

async function bootstrap() {
  try {
    const persisted = await loadLifecycleRssPersisted();
    if (persisted) {
      ({ rows } = persisted);
      rowsById = new Map(rows.map((row) => [row.id, row]));
      miniSearch = loadLifecycleSearchIndex(persisted.indexJSON);
      meta = persisted.meta;
      const storedBytes = meta?.storedBytes ?? estimateLifecycleRssSizeBytes(rows, persisted.indexJSON);
      ui.renderDatasetReady(meta, storedBytes);
      ui.enableSearch(true);
      ui.renderResults(rows.slice(0, MAX_RENDERED_ROWS), {
        total: rows.length,
        limited: rows.length > MAX_RENDERED_ROWS,
        query: "",
        rowCount: rows.length
      });
      ui.showStatus(
        "success",
        `Loaded ${rows.length} row${rows.length === 1 ? "" : "s"} from stored RSS data.`,
        { dismissAfter: 3200 }
      );
    } else {
      ui.renderDatasetEmpty();
    }
  } catch (error) {
    console.error("Failed to restore Hardware LifeCycle data", error);
    ui.renderDatasetEmpty();
    ui.showStatus("error", error.message || "Failed to load stored Hardware LifeCycle data.");
  }
}

async function handleImportText(xmlText) {
  const source = String(xmlText || "").trim();
  if (!source) {
    ui.showModalStatus("warn", "Paste RSS XML into the text box first.");
    return;
  }

  ui.setLoading(true, "Importing pasted RSS XML…");
  try {
    const result = parseLifecycleRssText(source);
    await applyDataset(result, {
      sourceLabel: "Pasted Fortinet RSS XML"
    });
    ui.clearPasteInput();
    ui.closeModal();
    ui.showStatus(
      "success",
      `Imported ${rows.length} row${rows.length === 1 ? "" : "s"} from pasted RSS XML.`,
      { dismissAfter: 4500 }
    );
  } catch (error) {
    console.error("Failed to import pasted Hardware LifeCycle XML", error);
    ui.showModalStatus("error", error.message || "Failed to import pasted RSS XML.", {
      dismissAfter: 7000
    });
  } finally {
    ui.setLoading(false);
  }
}

async function handleImportClipboard() {
  if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
    ui.showModalStatus("warn", "Clipboard paste is not available in this browser. Paste the XML manually instead.");
    ui.showPasteInput();
    return;
  }

  try {
    const clipboardText = await navigator.clipboard.readText();
    if (!String(clipboardText || "").trim()) {
      ui.showModalStatus("warn", "Your clipboard is empty. Copy the RSS XML first, then try again.");
      return;
    }

    ui.setLoading(true, "Importing clipboard RSS XML…");
    try {
      const result = parseLifecycleRssText(clipboardText);
      await applyDataset(result, {
        sourceLabel: "Clipboard Fortinet RSS XML"
      });
      ui.clearPasteInput();
      ui.closeModal();
      ui.showStatus(
        "success",
        `Imported ${rows.length} row${rows.length === 1 ? "" : "s"} from clipboard RSS XML.`,
        { dismissAfter: 4500 }
      );
    } catch (error) {
      console.error("Failed to import clipboard Hardware LifeCycle XML", error);
      ui.setPasteInputValue(clipboardText);
      ui.showModalStatus(
        "warn",
        "Clipboard content did not parse as Fortinet RSS XML. Review or replace it below, then press Ctrl+Enter to import.",
        { dismissAfter: 7000 }
      );
    } finally {
      ui.setLoading(false);
    }
  } catch (error) {
    console.error("Failed to read RSS XML from clipboard", error);
    ui.showModalStatus("warn", "Clipboard access was blocked. Paste the XML manually instead.");
    ui.showPasteInput();
  }
}

function handleOpenFeed() {
  window.open(FORTINET_RSS_URL, "_blank", "noopener,noreferrer");
  ui.showStatus("info", "Opened the Fortinet RSS feed in a new tab. Select all, copy the XML, then click Paste from clipboard in the refresh dialog.", {
    dismissAfter: 6000
  });
}

function handleOpenModal() {
  ui.showStatus("info", "Use the refresh dialog to open the Fortinet RSS feed, select all, copy the XML, then click Paste from clipboard.", {
    dismissAfter: 5000
  });
}

async function handleClear() {
  if (!rows.length && !miniSearch) {
    ui.showStatus("info", "Hardware LifeCycle data is already empty.");
    return;
  }

  await clearLifecycleRssPersisted();
  rows = [];
  rowsById = new Map();
  miniSearch = null;
  meta = null;

  ui.renderDatasetEmpty();
  ui.enableSearch(false);
  ui.showStatus("success", "Cleared stored Hardware LifeCycle data.");
}

function handleSearch(query) {
  if (!rows.length || !miniSearch) {
    ui.renderResults([], { total: 0, query, rowCount: rows.length });
    return;
  }

  const normalized = String(query || "").trim();
  if (!normalized) {
    ui.renderResults(rows.slice(0, MAX_RENDERED_ROWS), {
      total: rows.length,
      limited: rows.length > MAX_RENDERED_ROWS,
      query: "",
      rowCount: rows.length
    });
    return;
  }

  const { hits, total } = searchLifecycleRows(miniSearch, rowsById, query, MAX_RENDERED_ROWS);
  ui.renderResults(hits, {
    total,
    limited: total > MAX_RENDERED_ROWS,
    query,
    rowCount: rows.length
  });
}

function buildUploadMessage(count, feedTitle, skippedRows) {
  let message = `Loaded ${count} row${count === 1 ? "" : "s"} from “${feedTitle || "RSS feed"}”.`;
  if (skippedRows) {
    message += ` Skipped ${skippedRows} incomplete row${skippedRows === 1 ? "" : "s"}.`;
  }
  return message;
}

async function applyDataset(result, options = {}) {
  rows = result.rows;
  rowsById = new Map(rows.map((row) => [row.id, row]));

  const { index, exported } = createLifecycleSearchIndex(rows);
  miniSearch = index;

  meta = {
    updatedAt: new Date().toISOString(),
    rowCount: rows.length,
    feedTitle: options.sourceLabel || result.meta.feedTitle,
    feedUpdatedAt: result.meta.feedUpdatedAt,
    skippedRows: result.meta.skippedRows,
    feedSourceTitle: result.meta.feedTitle
  };

  const storedBytes = estimateLifecycleRssSizeBytes(rows, exported);
  meta.storedBytes = storedBytes;
  await saveLifecycleRssPersisted(rows, exported, meta);

  ui.renderDatasetReady(meta, storedBytes);
  ui.enableSearch(true);
  ui.focusSearch();
  ui.renderResults(rows.slice(0, MAX_RENDERED_ROWS), {
    total: rows.length,
    limited: rows.length > MAX_RENDERED_ROWS,
    query: "",
    rowCount: rows.length
  });
}
