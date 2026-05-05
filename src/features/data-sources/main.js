import { ingestWorkbook } from "../../shared/data/ingest.js";
import { createSearchIndex } from "../../shared/data/search.js";
import {
  savePersisted,
  saveOrderingGuideRows,
  estimateSizeBytes
} from "../../shared/data/storage.js";
import { parseLifecycleRssText } from "../hardware-lifecycle/rss.js";
import { createLifecycleSearchIndex as createHwSearchIndex } from "../hardware-lifecycle/search.js";
import {
  saveLifecycleRssPersisted,
  estimateLifecycleRssSizeBytes
} from "../hardware-lifecycle/storage.js";
import { parseSoftwareLifecycleRssText } from "../software-lifecycle/rss.js";
import { createLifecycleSearchIndex as createSwSearchIndex } from "../software-lifecycle/search.js";
import {
  saveSoftwareLifecyclePersisted,
  estimateSoftwareLifecycleSizeBytes
} from "../software-lifecycle/storage.js";
import {
  saveSharedDataset,
  deleteSharedDataset,
  getAllSharedDatasetMeta
} from "../../shared/data/shared-storage.js";
import { buildPricingDataset } from "../../shared/data/pricing-mapper.js";
import {
  buildHardwareLifecycleDataset,
  buildSoftwareLifecycleDataset
} from "../../shared/data/lifecycle-mapper.js";
import { initThemeToggle } from "../../shared/ui/theme.js";
import { initToolboxNav } from "../../shared/ui/nav.js";
import { notifyAdminRequirementsChanged } from "../../shared/ui/admin-alerts.js";

const STATUS_TIMEOUT = 5000;
const POPUP_WIDTH = 760;
const POPUP_HEIGHT = 720;

initToolboxNav({ current: "data-sources", basePath: "../" });
initThemeToggle();
initPricingCard();
initAssetReportsCard();
initLifecycleCard({
  prefix: "hw",
  feedUrl: "https://support.fortinet.com/rss/Hardware.xml",
  parseText: parseLifecycleRssText,
  createIndex: createHwSearchIndex,
  saveFeature: saveLifecycleRssPersisted,
  estimateSize: estimateLifecycleRssSizeBytes,
  buildShared: buildHardwareLifecycleDataset,
  sharedKey: "hardware_lifecycle",
  sourceLabel: "Fortinet Hardware LifeCycle RSS"
});
initLifecycleCard({
  prefix: "sw",
  feedUrl: "https://support.fortinet.com/rss/Software.xml",
  parseText: parseSoftwareLifecycleRssText,
  createIndex: createSwSearchIndex,
  saveFeature: saveSoftwareLifecyclePersisted,
  estimateSize: estimateSoftwareLifecycleSizeBytes,
  buildShared: buildSoftwareLifecycleDataset,
  sharedKey: "software_lifecycle",
  sourceLabel: "Fortinet Software LifeCycle RSS"
});
loadSharedStatus();

async function loadSharedStatus() {
  let records;
  try {
    records = await getAllSharedDatasetMeta();
  } catch {
    return;
  }
  for (const record of records) {
    updateCardStatus(record.key, record);
  }
}

// ── PRICING ───────────────────────────────────────────────────────────────

function initPricingCard() {
  const importBtn = document.getElementById("ds-pricing-import-btn");
  const fileInput = document.getElementById("ds-pricing-file");
  const clearBtn = document.getElementById("ds-pricing-clear-btn");

  importBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handlePricingImport(file);
    fileInput.value = "";
  });

  clearBtn.addEventListener("click", async () => {
    clearBtn.disabled = true;
    try {
      await deleteSharedDataset("pricing");
      updateCardStatus("pricing", null);
      notifyAdminRequirementsChanged();
    } catch (err) {
      console.error("Failed to clear shared pricing dataset", err);
      clearBtn.disabled = false;
    }
  });
}

async function handlePricingImport(file) {
  setCardLoading("pricing", true);
  try {
    const result = await ingestWorkbook(file);
    const rows = result.rows;
    const { exported } = createSearchIndex(rows);

    const meta = {
      updatedAt: new Date().toISOString(),
      rowCount: rows.length,
      sheetName: result.sheetName,
      skippedRows: result.stats.skippedRows,
      priceListLabel: result.coverInfo || null,
      filename: file.name
    };
    meta.storedBytes = estimateSizeBytes(rows, exported);

    await savePersisted(rows, exported, meta);
    await saveOrderingGuideRows(result.orderingGuideRows);
    await saveSharedDataset("pricing", buildPricingDataset(rows, meta, result.rawPricingData));
    notifyAdminRequirementsChanged();

    const displayName = result.rawPricingData?.name ?? meta.priceListLabel;
    updateCardStatus("pricing", {
      source: { importedAt: meta.updatedAt },
      meta: { rowCount: rows.length, datasetName: displayName }
    });

    let msg = `Imported ${rows.length} rows from "${result.sheetName}".`;
    if (result.stats.skippedRows) msg += ` Skipped ${result.stats.skippedRows} row(s) missing required fields.`;
    showCardStatus("pricing", "success", msg);
  } catch (err) {
    console.error("Pricing import failed", err);
    showCardStatus("pricing", "error", err.message || "Failed to process workbook.");
  } finally {
    setCardLoading("pricing", false);
  }
}

function initAssetReportsCard() {
  const clearBtn = document.getElementById("ds-ar-clear-btn");
  clearBtn.addEventListener("click", async () => {
    clearBtn.disabled = true;
    try {
      await deleteSharedDataset("asset_reports");
      updateCardStatus("asset_reports", null);
      notifyAdminRequirementsChanged();
    } catch (err) {
      console.error("Failed to clear shared asset report dataset", err);
      clearBtn.disabled = false;
    }
  });
}

// ── LIFECYCLE (shared factory) ─────────────────────────────────────────────

function initLifecycleCard({ prefix, feedUrl, parseText, createIndex, saveFeature, estimateSize, buildShared, sharedKey, sourceLabel }) {
  const refreshBtn = document.getElementById(`ds-${prefix}-refresh-btn`);
  const clearBtn = document.getElementById(`ds-${prefix}-clear-btn`);
  const modal = document.getElementById(`ds-${prefix}-modal`);
  const openFeedBtn = document.getElementById(`ds-${prefix}-open-feed-btn`);
  const pasteClipBtn = document.getElementById(`ds-${prefix}-paste-clip-btn`);
  const closeBtn = document.getElementById(`ds-${prefix}-close-btn`);
  const pasteInput = document.getElementById(`ds-${prefix}-paste-input`);
  const modalStatus = document.getElementById(`ds-${prefix}-modal-status`);

  let manualPasteMode = false;

  refreshBtn.addEventListener("click", () => {
    modal.showModal?.();
    resetModalState();
  });

  closeBtn.addEventListener("click", () => modal.close());
  modal.addEventListener("cancel", () => modal.close());

  openFeedBtn.addEventListener("click", () => {
    openFeedWindow(feedUrl);
    showModalStatus("info", "Opened the Fortinet RSS feed in a new tab. Select all, copy the XML, then click Paste from clipboard.", { dismissAfter: 7000 });
  });

  pasteClipBtn.addEventListener("click", () => {
    if (manualPasteMode) {
      handleRssImport(pasteInput.value);
      return;
    }
    handleClipboardImport();
  });

  pasteInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleRssImport(pasteInput.value);
    }
  });

  clearBtn.addEventListener("click", async () => {
    clearBtn.disabled = true;
    try {
      await deleteSharedDataset(sharedKey);
      updateCardStatus(sharedKey, null);
      notifyAdminRequirementsChanged();
    } catch (err) {
      console.error("Failed to clear shared lifecycle dataset", err);
      clearBtn.disabled = false;
    }
  });

  function resetModalState() {
    pasteInput.value = "";
    pasteInput.hidden = true;
    manualPasteMode = false;
    pasteClipBtn.textContent = "Paste from clipboard";
    modalStatus.textContent = "";
    modalStatus.className = "rss-modal-status info";
  }

  function enterManualPasteMode(prefillText = null) {
    manualPasteMode = true;
    pasteClipBtn.textContent = "Import pasted XML";
    pasteInput.hidden = false;
    if (prefillText !== null) pasteInput.value = prefillText;
    pasteInput.focus();
  }

  let modalStatusTimer = null;
  function showModalStatus(level, message, { dismissAfter = 5000 } = {}) {
    clearTimeout(modalStatusTimer);
    modalStatus.textContent = message;
    modalStatus.className = `rss-modal-status ${level}`;
    if (dismissAfter > 0) {
      modalStatusTimer = setTimeout(() => {
        modalStatus.textContent = "";
        modalStatus.className = "rss-modal-status info";
      }, dismissAfter);
    }
  }

  async function handleClipboardImport() {
    if (!navigator.clipboard?.readText) {
      showModalStatus("warn", "Clipboard paste is not available. Paste the XML manually.");
      enterManualPasteMode();
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!String(text || "").trim()) {
        showModalStatus("warn", "Your clipboard is empty. Copy the RSS XML first.");
        return;
      }
      await processRssText(text);
    } catch {
      showModalStatus("warn", "Clipboard access was blocked. Paste the XML manually.");
      enterManualPasteMode();
    }
  }

  async function handleRssImport(xmlText) {
    const source = String(xmlText || "").trim();
    if (!source) {
      showModalStatus("warn", "Paste RSS XML into the text box first.");
      return;
    }
    await processRssText(source);
  }

  async function processRssText(xmlText) {
    setCardLoading(sharedKey, true);
    openFeedBtn.disabled = true;
    pasteClipBtn.disabled = true;

    try {
      const result = parseText(xmlText);
      const rows = result.rows;
      const { exported } = createIndex(rows);

      const meta = {
        updatedAt: new Date().toISOString(),
        rowCount: rows.length,
        feedTitle: sourceLabel,
        feedUpdatedAt: result.meta.feedUpdatedAt,
        skippedRows: result.meta.skippedRows,
        feedSourceTitle: result.meta.feedTitle
      };
      meta.storedBytes = estimateSize(rows, exported);

      await saveFeature(rows, exported, meta);
      await saveSharedDataset(sharedKey, buildShared(rows, meta));
      notifyAdminRequirementsChanged();

      updateCardStatus(sharedKey, {
        source: { label: result.meta.feedTitle, importedAt: meta.updatedAt },
        meta: { rowCount: rows.length }
      });
      modal.close();

      const rowWord = rows.length === 1 ? "row" : "rows";
      showCardStatus(sharedKey, "success", `Imported ${rows.length} ${rowWord} from RSS.`);
    } catch (err) {
      console.error(`RSS import failed (${sharedKey})`, err);
      showModalStatus("error", err.message || "Failed to import RSS XML.", { dismissAfter: 8000 });
      if (!manualPasteMode) enterManualPasteMode(xmlText);
    } finally {
      setCardLoading(sharedKey, false);
      openFeedBtn.disabled = false;
      pasteClipBtn.disabled = false;
    }
  }
}

// ── SHARED CARD HELPERS ────────────────────────────────────────────────────

function updateCardStatus(key, record) {
  const badgeId = `ds-${keyToPrefix(key)}-badge`;
  const metaId = `ds-${keyToPrefix(key)}-meta`;
  const clearBtnId = `ds-${keyToPrefix(key)}-clear-btn`;

  const badge = document.getElementById(badgeId);
  const metaEl = document.getElementById(metaId);
  const clearBtn = document.getElementById(clearBtnId);
  if (!badge || !metaEl) return;

  if (record) {
    const importedAt = record.source?.importedAt
      ? new Date(record.source.importedAt).toLocaleString()
      : "Unknown time";
    const labelText = record.meta?.datasetName ?? record.source?.label ?? null;
    const label = labelText ? ` — ${labelText}` : "";
    const rowCount = record.meta?.rowCount ?? "?";

    badge.textContent = "Available";
    badge.className = "ds-badge ds-badge--ok";
    metaEl.innerHTML = `<span>${Number(rowCount).toLocaleString()} rows</span><span>Imported ${importedAt}${label}</span>`;
    if (clearBtn) clearBtn.disabled = false;
  } else {
    badge.textContent = "No data";
    badge.className = "ds-badge ds-badge--empty";
    metaEl.innerHTML = `<span>Not yet imported</span>`;
    if (clearBtn) clearBtn.disabled = true;
  }
}

let statusTimers = {};
function showCardStatus(key, level, message) {
  const prefix = keyToPrefix(key);
  const el = document.getElementById(`ds-${prefix}-status`);
  if (!el) return;
  clearTimeout(statusTimers[key]);
  el.textContent = message;
  el.className = `status-message ${level} ds-card-status`;
  statusTimers[key] = setTimeout(() => {
    el.textContent = "";
  }, STATUS_TIMEOUT);
}

function setCardLoading(key, loading) {
  const prefix = keyToPrefix(key);
  const spinner = document.getElementById(`ds-${prefix}-spinner`);
  if (spinner) spinner.hidden = !loading;
  const importBtn = document.getElementById(`ds-${prefix}-import-btn`);
  if (importBtn) importBtn.disabled = loading;
  const refreshBtn = document.getElementById(`ds-${prefix}-refresh-btn`);
  if (refreshBtn) refreshBtn.disabled = loading;
}

function keyToPrefix(key) {
  if (key === "pricing") return "pricing";
  if (key === "asset_reports") return "ar";
  if (key === "hardware_lifecycle") return "hw";
  if (key === "software_lifecycle") return "sw";
  return key;
}

function openFeedWindow(url) {
  const left = Math.max(0, Math.round((screen.width - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round((screen.height - POPUP_HEIGHT) / 2));
  const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},popup=yes,noopener=yes,noreferrer=yes,resizable=yes,scrollbars=yes`;
  const popup = window.open(url, "_blank", features);
  if (popup?.focus) popup.focus();
}
