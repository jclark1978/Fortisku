import { parseSoftwareLifecycleRssText } from "./rss.js";
import { createLifecycleSearchIndex, loadLifecycleSearchIndex, searchLifecycleRows } from "./search.js";
import {
  clearSoftwareLifecyclePersisted,
  estimateSoftwareLifecycleSizeBytes,
  loadSoftwareLifecyclePersisted,
  saveSoftwareLifecyclePersisted
} from "./storage.js";
import { startLifecycleApp } from "../../shared/lifecycle/app.js";
import { initSoftwareLifecycleUI } from "./ui.js";
import { buildSoftwareLifecycleDataset } from "../../shared/data/lifecycle-mapper.js";

startLifecycleApp({
  currentNav: "software-lifecycle",
  feedUrl: "https://support.fortinet.com/rss/Software.xml",
  parseText: parseSoftwareLifecycleRssText,
  createUi: initSoftwareLifecycleUI,
  search: {
    createIndex: createLifecycleSearchIndex,
    loadIndex: loadLifecycleSearchIndex,
    searchRows: searchLifecycleRows
  },
  storage: {
    clearPersisted: clearSoftwareLifecyclePersisted,
    estimateSizeBytes: estimateSoftwareLifecycleSizeBytes,
    loadPersisted: loadSoftwareLifecyclePersisted,
    savePersisted: saveSoftwareLifecyclePersisted
  },
  shared: {
    key: "software_lifecycle",
    buildDataset: buildSoftwareLifecycleDataset
  },
  messages: {
    restoreLogLabel: "Failed to restore Software LifeCycle data",
    restoreErrorMessage: "Failed to load stored Software LifeCycle data.",
    importLogLabel: "Failed to import pasted Software LifeCycle XML",
    clipboardImportLogLabel: "Failed to import clipboard Software LifeCycle XML",
    pastedSourceLabel: "Pasted Fortinet Software RSS XML",
    clipboardSourceLabel: "Clipboard Fortinet Software RSS XML",
    clipboardParseWarning: "Clipboard content did not parse as Fortinet software RSS XML. Review or replace it below, then press Ctrl+Enter to import.",
    openFeedStatus: "Opened the Fortinet RSS feed in a new tab. Select all, copy the XML, then click Paste from clipboard in the refresh dialog.",
    openModalStatus: "Use the refresh dialog to open the Fortinet RSS feed, select all, copy the XML, then click Paste from clipboard.",
    alreadyEmptyMessage: "Software LifeCycle data is already empty.",
    clearedMessage: "Cleared stored Software LifeCycle data."
  }
});
