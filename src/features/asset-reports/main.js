import { initThemeToggle } from "../../shared/ui/theme.js";
import { initToolboxNav } from "../../shared/ui/nav.js";
import { buildAssetReportWorkbook, buildOutputFilename, inspectAssetWorkbook } from "./workbook.js";
import { initAssetReportUI } from "./ui.js";

let inspectedWorkbook = null;

const ui = initAssetReportUI({
  onFileSelected: handleFileSelected,
  onCustomerNameChange: handleCustomerNameChange,
  onBuild: handleBuild,
  onClear: handleClear,
  getOutputFilename: (customerName) => buildOutputFilename(customerName, inspectedWorkbook?.sourceFilename || "")
});

initToolboxNav({ current: "asset-reports", basePath: "../" });
initThemeToggle();
ui.setReadyState();

async function handleFileSelected(file) {
  ui.setLoading(true);
  try {
    inspectedWorkbook = await inspectAssetWorkbook(file);
    ui.renderWorkbook(inspectedWorkbook);
    ui.setOutputFilename(buildOutputFilename("", inspectedWorkbook.sourceFilename));

    let message = `Loaded ${inspectedWorkbook.rowCount.toLocaleString()} asset row`;
    message += inspectedWorkbook.rowCount === 1 ? "" : "s";
    message += ` from “${inspectedWorkbook.sheetName}”.`;
    if (inspectedWorkbook.skippedRows) {
      message += ` Skipped ${inspectedWorkbook.skippedRows} invalid row`;
      message += inspectedWorkbook.skippedRows === 1 ? "." : "s.";
    }
    ui.showStatus("success", message, { dismissAfter: 5000 });
  } catch (error) {
    inspectedWorkbook = null;
    ui.setReadyState();
    ui.showStatus("error", error.message || "Failed to read workbook.", { dismissAfter: 0 });
  } finally {
    ui.setLoading(false);
  }
}

function handleCustomerNameChange() {
  if (!inspectedWorkbook) {
    ui.setOutputFilename("—");
  }
}

async function handleBuild({ customerName }) {
  if (!inspectedWorkbook) {
    ui.showStatus("warn", "Upload a workbook before generating the report.");
    return;
  }
  if (!customerName) {
    ui.showStatus("warn", "Enter a customer name before generating the report.");
    return;
  }

  ui.setLoading(true);
  try {
    const result = buildAssetReportWorkbook({
      customerName,
      sourceFilename: inspectedWorkbook.sourceFilename,
      sheetName: inspectedWorkbook.sheetName,
      detailRows: inspectedWorkbook.detailRows,
      assetCounts: inspectedWorkbook.assetCounts,
      renewalCounts: inspectedWorkbook.renewalCounts
    });
    ui.triggerDownload(result.filename, result.blob);
    ui.setOutputFilename(result.filename);
    ui.showStatus("success", `Generated ${result.filename}`, { dismissAfter: 5000 });
  } catch (error) {
    ui.showStatus("error", error.message || "Failed to generate workbook.", { dismissAfter: 0 });
  } finally {
    ui.setLoading(false);
  }
}

function handleClear() {
  inspectedWorkbook = null;
  ui.reset();
}
