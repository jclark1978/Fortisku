import { initThemeToggle } from "../ui/theme.js";
import { initToolboxNav } from "../ui/nav.js";
import { notifyAdminRequirementsChanged } from "../ui/admin-alerts.js";

const MAX_RENDERED_ROWS = 200;
const POPUP_WIDTH = 760;
const POPUP_HEIGHT = 720;

export function startLifecycleApp(config) {
  const {
    currentNav,
    basePath = "../",
    feedUrl,
    parseText,
    createUi,
    search,
    storage,
    messages
  } = config;

  let rows = [];
  let rowsById = new Map();
  let miniSearch = null;
  let meta = null;

  const ui = createUi({
    onImportText: handleImportText,
    onImportClipboard: handleImportClipboard,
    onOpenFeed: handleOpenFeed,
    onOpenModal: handleOpenModal,
    onClear: handleClear,
    onSearch: handleSearch
  });

  initToolboxNav({ current: currentNav, basePath });
  initThemeToggle();
  bootstrap();

  async function bootstrap() {
    try {
      const persisted = await storage.loadPersisted();
      if (persisted) {
        ({ rows } = persisted);
        rowsById = new Map(rows.map((row) => [row.id, row]));
        miniSearch = search.loadIndex(persisted.indexJSON);
        meta = persisted.meta;
        const storedBytes = meta?.storedBytes ?? storage.estimateSizeBytes(rows, persisted.indexJSON);
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
      console.error(messages.restoreLogLabel, error);
      ui.renderDatasetEmpty();
      ui.showStatus("error", error.message || messages.restoreErrorMessage);
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
      const result = parseText(source);
      await applyDataset(result, {
        sourceLabel: messages.pastedSourceLabel
      });
      ui.clearPasteInput();
      ui.closeModal();
      ui.showStatus(
        "success",
        `Imported ${rows.length} row${rows.length === 1 ? "" : "s"} from pasted RSS XML.`,
        { dismissAfter: 4500 }
      );
    } catch (error) {
      console.error(messages.importLogLabel, error);
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
        const result = parseText(clipboardText);
        await applyDataset(result, {
          sourceLabel: messages.clipboardSourceLabel
        });
        ui.clearPasteInput();
        ui.closeModal();
        ui.showStatus(
          "success",
          `Imported ${rows.length} row${rows.length === 1 ? "" : "s"} from clipboard RSS XML.`,
          { dismissAfter: 4500 }
        );
      } catch (error) {
        console.error(messages.clipboardImportLogLabel, error);
        ui.setPasteInputValue(clipboardText);
        ui.showModalStatus("warn", messages.clipboardParseWarning, {
          dismissAfter: 7000
        });
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
    openFeedWindow(feedUrl);
    ui.showStatus("info", messages.openFeedStatus, {
      dismissAfter: 6000
    });
  }

  function handleOpenModal() {
    ui.showStatus("info", messages.openModalStatus, {
      dismissAfter: 5000
    });
  }

  async function handleClear() {
    if (!rows.length && !miniSearch) {
      ui.showStatus("info", messages.alreadyEmptyMessage);
      return;
    }

    await storage.clearPersisted();
    notifyAdminRequirementsChanged();
    rows = [];
    rowsById = new Map();
    miniSearch = null;
    meta = null;

    ui.renderDatasetEmpty();
    ui.enableSearch(false);
    ui.showStatus("success", messages.clearedMessage);
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

    const { hits, total } = search.searchRows(miniSearch, rowsById, query, MAX_RENDERED_ROWS);
    ui.renderResults(hits, {
      total,
      limited: total > MAX_RENDERED_ROWS,
      query,
      rowCount: rows.length
    });
  }

  async function applyDataset(result, options = {}) {
    rows = result.rows;
    rowsById = new Map(rows.map((row) => [row.id, row]));

    const { index, exported } = search.createIndex(rows);
    miniSearch = index;

    meta = {
      updatedAt: new Date().toISOString(),
      rowCount: rows.length,
      feedTitle: options.sourceLabel || result.meta.feedTitle,
      feedUpdatedAt: result.meta.feedUpdatedAt,
      skippedRows: result.meta.skippedRows,
      feedSourceTitle: result.meta.feedTitle
    };

    const storedBytes = storage.estimateSizeBytes(rows, exported);
    meta.storedBytes = storedBytes;
    await storage.savePersisted(rows, exported, meta);
    notifyAdminRequirementsChanged();

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

  return {
    handleImportText,
    handleImportClipboard,
    handleOpenFeed,
    handleOpenModal,
    handleClear,
    handleSearch
  };
}

function openFeedWindow(feedUrl) {
  const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const left = Math.max(0, dualScreenLeft + Math.round((viewportWidth - POPUP_WIDTH) / 2));
  const top = Math.max(0, dualScreenTop + Math.round((viewportHeight - POPUP_HEIGHT) / 2));
  const features = [
    `width=${POPUP_WIDTH}`,
    `height=${POPUP_HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    "popup=yes",
    "noopener=yes",
    "noreferrer=yes",
    "resizable=yes",
    "scrollbars=yes"
  ].join(",");

  const popup = window.open(feedUrl, "_blank", features);
  if (popup && typeof popup.focus === "function") {
    popup.focus();
  }
}
