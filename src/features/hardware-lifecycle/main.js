import { parseLifecycleRssText } from "./rss.js";
import { createLifecycleSearchIndex, loadLifecycleSearchIndex, searchLifecycleRows } from "./search.js";
import {
  clearLifecycleRssPersisted,
  estimateLifecycleRssSizeBytes,
  loadLifecycleRssPersisted,
  saveLifecycleRssPersisted
} from "./storage.js";
import { startLifecycleApp } from "../../shared/lifecycle/app.js";
import { initLifecycleRssUI } from "./ui.js";
import { buildHardwareLifecycleDataset } from "../../shared/data/lifecycle-mapper.js";

startLifecycleApp({
  currentNav: "hardware-lifecycle",
  feedUrl: "https://support.fortinet.com/rss/Hardware.xml",
  parseText: parseLifecycleRssText,
  createUi: initLifecycleRssUI,
  search: {
    createIndex: createLifecycleSearchIndex,
    loadIndex: loadLifecycleSearchIndex,
    searchRows: searchLifecycleRows
  },
  storage: {
    clearPersisted: clearLifecycleRssPersisted,
    estimateSizeBytes: estimateLifecycleRssSizeBytes,
    loadPersisted: loadLifecycleRssPersisted,
    savePersisted: saveLifecycleRssPersisted
  },
  shared: {
    key: "hardware_lifecycle",
    buildDataset: buildHardwareLifecycleDataset
  },
  messages: {
    restoreLogLabel: "Failed to restore Hardware LifeCycle data",
    restoreErrorMessage: "Failed to load stored Hardware LifeCycle data.",
    importLogLabel: "Failed to import pasted Hardware LifeCycle XML",
    clipboardImportLogLabel: "Failed to import clipboard Hardware LifeCycle XML",
    pastedSourceLabel: "Pasted Fortinet RSS XML",
    clipboardSourceLabel: "Clipboard Fortinet RSS XML",
    clipboardParseWarning: "Clipboard content did not parse as Fortinet RSS XML. Review or replace it below, then press Ctrl+Enter to import.",
    openFeedStatus: "Opened the Fortinet RSS feed in a new tab. Select all, copy the XML, then click Paste from clipboard in the refresh dialog.",
    openModalStatus: "Use the refresh dialog to open the Fortinet RSS feed, select all, copy the XML, then click Paste from clipboard.",
    alreadyEmptyMessage: "Hardware LifeCycle data is already empty.",
    clearedMessage: "Cleared stored Hardware LifeCycle data."
  }
});
