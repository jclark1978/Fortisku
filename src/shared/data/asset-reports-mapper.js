const ASSET_REPORT_HEADERS = [
  "Serial Number",
  "Product Model",
  "Description",
  "Unit Expiration Date",
  "Registration Date"
];

export function buildAssetReportsDataset(inspectedWorkbook, importedAt = new Date().toISOString()) {
  const detailRows = (inspectedWorkbook.detailRows || []).map(toSharedDetailRow);
  const assetCounts = (inspectedWorkbook.assetCounts || []).map(toSharedCountRow);
  const renewalCounts = (inspectedWorkbook.renewalCounts || []).map(toSharedCountRow);

  return {
    key: "asset_reports",
    version: 1,
    source: {
      type: "xlsx",
      filename: inspectedWorkbook.sourceFilename || null,
      importedAt
    },
    data: {
      ok: true,
      sheetName: inspectedWorkbook.sheetName || "products",
      headers: ASSET_REPORT_HEADERS,
      detailRows,
      assetCounts,
      renewalCounts,
      uploadedAt: importedAt
    },
    meta: {
      rowCount: detailRows.length,
      headerCount: ASSET_REPORT_HEADERS.length,
      skippedRows: inspectedWorkbook.skippedRows || 0,
      modelCount: assetCounts.length,
      renewalQuarterCount: renewalCounts.length,
      datasetName: "Asset Report Inventory"
    }
  };
}

function toSharedDetailRow(row) {
  return {
    serialNumber: row.serialNumber,
    productModel: row.productModel,
    description: row.description,
    unitExpirationDate: toIsoDateString(row.unitExpirationDate),
    quarter: row.quarter,
    registrationDate: toIsoDateString(row.registrationDate)
  };
}

function toSharedCountRow(row) {
  return {
    label: row.label,
    count: Number(row.count || 0)
  };
}

function toIsoDateString(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
