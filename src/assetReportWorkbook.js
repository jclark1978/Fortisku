import { read, utils } from "../vendor/xlsx.mjs";

const REQUIRED_HEADERS = [
  "Serial Number",
  "Product Model",
  "Description",
  "Unit Expiration Date",
  "Registration Date"
];

const HEADER_KEY_MAP = new Map([
  ["serialnumber", "serialNumber"],
  ["productmodel", "productModel"],
  ["description", "description"],
  ["unitexpirationdate", "unitExpirationDate"],
  ["registrationdate", "registrationDate"]
]);

const COLUMN_WIDTHS = [
  19,
  23.1640625,
  56,
  20.6640625,
  10,
  18.1640625,
  3,
  23.1640625,
  8.33203125,
  3,
  10,
  14.83203125
];

export async function inspectAssetWorkbook(file) {
  if (!file) {
    throw new Error("No workbook was selected.");
  }

  const data = await file.arrayBuffer();
  const workbook = await read(data);
  const sheetName = resolveSheetName(workbook);
  const sheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json(sheet, { header: 1 });

  if (!rows.length) {
    throw new Error(`Sheet “${sheetName}” is empty.`);
  }

  const headerInfo = findHeaderRow(rows);
  if (!headerInfo) {
    throw new Error(`Could not locate the required headers: ${REQUIRED_HEADERS.join(", ")}.`);
  }

  const detailRows = [];
  let skippedRows = 0;

  for (let rowIndex = headerInfo.index + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || row.every((value) => value === undefined || value === null || String(value).trim() === "")) {
      continue;
    }

    const record = mapRow(row, headerInfo.headerMap);
    if (!record) {
      skippedRows += 1;
      continue;
    }
    detailRows.push(record);
  }

  if (!detailRows.length) {
    throw new Error("No valid asset rows were found after the header row.");
  }

  detailRows.sort(compareDetailRows);

  const assetCounts = buildAssetCounts(detailRows);
  const renewalCounts = buildRenewalCounts(detailRows);

  return {
    sourceFilename: file.name || "asset-report.xlsx",
    sheetName,
    rowCount: detailRows.length,
    skippedRows,
    detailRows,
    assetCounts,
    renewalCounts
  };
}

export function buildOutputFilename(customerName, sourceFilename) {
  if (!sourceFilename) {
    return "—";
  }
  const baseName = String(sourceFilename).replace(/\.[^.]+$/, "");
  const cleanBase = sanitizeFilenamePart(baseName) || "asset-report";
  const cleanCustomer = sanitizeFilenamePart(customerName) || "customer";
  return `${cleanCustomer}-${cleanBase}.xlsx`;
}

export function buildAssetReportWorkbook({ customerName, sourceFilename, sheetName, detailRows, assetCounts, renewalCounts }) {
  if (!Array.isArray(detailRows) || !detailRows.length) {
    throw new Error("No asset rows are available to write.");
  }

  const filename = buildOutputFilename(customerName, sourceFilename);
  const workbookBytes = buildWorkbookBytes({
    sheetName: sheetName || "products",
    detailRows,
    assetCounts,
    renewalCounts
  });

  return {
    filename,
    blob: new Blob([workbookBytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
  };
}

function resolveSheetName(workbook) {
  const names = workbook.SheetNames || [];
  const preferred = names.find((name) => String(name).trim().toLowerCase() === "products");
  return preferred || names[0] || "products";
}

function findHeaderRow(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const headerMap = mapHeaders(row);
    if (REQUIRED_HEADERS.every((header) => headerMap.has(HEADER_KEY_MAP.get(normalizeKey(header))))) {
      return { index, headerMap };
    }
  }
  return null;
}

function mapHeaders(row) {
  const map = new Map();
  for (let index = 0; index < row.length; index += 1) {
    const key = HEADER_KEY_MAP.get(normalizeKey(row[index]));
    if (key && !map.has(key)) {
      map.set(key, index);
    }
  }
  return map;
}

function mapRow(row, headerMap) {
  const serialNumber = sanitizeText(row[headerMap.get("serialNumber")]);
  const productModel = sanitizeText(row[headerMap.get("productModel")]);
  const description = sanitizeText(row[headerMap.get("description")]);
  const unitExpirationDate = parseDateValue(row[headerMap.get("unitExpirationDate")]);
  const registrationDate = parseDateValue(row[headerMap.get("registrationDate")]);

  if (!serialNumber || !productModel || !description || !unitExpirationDate || !registrationDate) {
    return null;
  }

  return {
    serialNumber,
    productModel,
    description,
    unitExpirationDate,
    quarter: buildQuarterLabel(unitExpirationDate),
    registrationDate
  };
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToDate(value);
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
  }

  const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const year = Number(usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3]);
    return new Date(Date.UTC(year, Number(usMatch[1]) - 1, Number(usMatch[2])));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  return null;
}

function excelSerialToDate(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  const wholeDays = Math.floor(serial);
  return new Date(epoch + wholeDays * 86400000);
}

function buildQuarterLabel(date) {
  const month = date.getUTCMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${date.getUTCFullYear()}`;
}

function compareDetailRows(left, right) {
  const dateDiff = left.unitExpirationDate.getTime() - right.unitExpirationDate.getTime();
  if (dateDiff !== 0) return dateDiff;

  const modelDiff = left.productModel.localeCompare(right.productModel, undefined, { sensitivity: "base" });
  if (modelDiff !== 0) return modelDiff;

  return left.serialNumber.localeCompare(right.serialNumber, undefined, { sensitivity: "base" });
}

function buildAssetCounts(detailRows) {
  const counts = new Map();
  for (const row of detailRows) {
    counts.set(row.productModel, (counts.get(row.productModel) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => (right.count - left.count) || left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function buildRenewalCounts(detailRows) {
  const counts = new Map();
  for (const row of detailRows) {
    counts.set(row.quarter, (counts.get(row.quarter) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => compareQuarterLabels(left.label, right.label));
}

function compareQuarterLabels(left, right) {
  const [leftQuarter, leftYear] = String(left).split(" ");
  const [rightQuarter, rightYear] = String(right).split(" ");
  const yearDiff = Number(leftYear) - Number(rightYear);
  if (yearDiff !== 0) return yearDiff;
  return Number(leftQuarter.replace("Q", "")) - Number(rightQuarter.replace("Q", ""));
}

function buildWorkbookBytes({ sheetName, detailRows, assetCounts, renewalCounts }) {
  const refs = buildTableRefs({ detailRows, assetCounts, renewalCounts });
  const worksheetXml = buildWorksheetXml({ detailRows, assetCounts, renewalCounts, refs });
  const workbookXmlContent = workbookXml(sheetName);
  const files = [
    { path: "[Content_Types].xml", data: utf8(contentTypesXml()) },
    { path: "_rels/.rels", data: utf8(rootRelsXml()) },
    { path: "docProps/app.xml", data: utf8(appXml(sheetName)) },
    { path: "docProps/core.xml", data: utf8(coreXml()) },
    { path: "xl/workbook.xml", data: utf8(workbookXmlContent) },
    { path: "xl/_rels/workbook.xml.rels", data: utf8(workbookRelsXml()) },
    { path: "xl/worksheets/_rels/sheet1.xml.rels", data: utf8(sheetRelsXml()) },
    { path: "xl/theme/theme1.xml", data: utf8(themeXml()) },
    { path: "xl/styles.xml", data: utf8(stylesXml()) },
    { path: "xl/worksheets/sheet1.xml", data: utf8(worksheetXml) },
    { path: "xl/tables/table1.xml", data: utf8(detailTableXml(refs.detailRef)) },
    { path: "xl/tables/table2.xml", data: utf8(assetCountTableXml(refs.assetRef)) },
    { path: "xl/tables/table3.xml", data: utf8(renewalTableXml(refs.renewalRef)) }
  ];

  return createStoredZip(files);
}

function buildWorksheetXml({ detailRows, assetCounts, renewalCounts, refs }) {
  const detailStartRow = 4;
  const assetStartRow = 4;
  const renewalStartRow = 4;
  const detailEndRow = Math.max(detailStartRow, detailStartRow + detailRows.length - 1);
  const assetEndRow = Math.max(assetStartRow, assetStartRow + assetCounts.length - 1);
  const renewalEndRow = Math.max(renewalStartRow, renewalStartRow + renewalCounts.length - 1);
  const referenceYear = new Date().getFullYear();
  const maxRow = Math.max(
    3,
    detailEndRow,
    assetEndRow,
    renewalEndRow
  );

  const rows = [];
  rows.push(xmlRow(2, [
    inlineCell("A2", "Asset Report", 1),
    inlineCell("H2", "Asset Count", 3),
    inlineCell("K2", "Renewal Schedule", 2)
  ], 25));

  rows.push(xmlRow(3, [
    inlineCell("A3", "Serial Number", 0),
    inlineCell("B3", "Product Model", 0),
    inlineCell("C3", "Description", 0),
    inlineCell("D3", "Unit Expiration Date", 0),
    inlineCell("E3", "Quarter", 0),
    inlineCell("F3", "Registration Date", 0),
    inlineCell("H3", "Product Model", 0),
    inlineCell("I3", "Count", 0),
    inlineCell("K3", "Quarter", 0),
    inlineCell("L3", "Count", 0)
  ], 20));

  for (let index = 0; index < detailRows.length; index += 1) {
    const rowNumber = detailStartRow + index;
    const row = detailRows[index];
    rows.push(xmlRow(rowNumber, [
      inlineCell(`A${rowNumber}`, row.serialNumber, 6),
      inlineCell(`B${rowNumber}`, row.productModel, 6),
      inlineCell(`C${rowNumber}`, row.description, 6),
      dateCell(`D${rowNumber}`, row.unitExpirationDate, 5),
      inlineCell(`E${rowNumber}`, row.quarter, 6),
      dateCell(`F${rowNumber}`, row.registrationDate, 5)
    ]));
  }

  for (let index = 0; index < assetCounts.length; index += 1) {
    const rowNumber = assetStartRow + index;
    const row = assetCounts[index];
    rows.push(appendRowCell(rows, rowNumber, inlineCell(`H${rowNumber}`, row.label, 6)));
    rows.push(appendRowCell(rows, rowNumber, numberCell(`I${rowNumber}`, row.count, 7)));
  }

  for (let index = 0; index < renewalCounts.length; index += 1) {
    const rowNumber = renewalStartRow + index;
    const row = renewalCounts[index];
    rows.push(appendRowCell(rows, rowNumber, inlineCell(`K${rowNumber}`, row.label, 6)));
    rows.push(appendRowCell(rows, rowNumber, numberCell(`L${rowNumber}`, row.count, 7)));
  }

  const merged = `
    <mergeCells count="3">
      <mergeCell ref="A2:F2"/>
      <mergeCell ref="H2:I2"/>
      <mergeCell ref="K2:L2"/>
    </mergeCells>
  `;

  const conditionalFormatting = [
    buildDateConditionalFormatting(detailStartRow, detailEndRow, referenceYear, 1),
    buildQuarterConditionalFormatting("E", detailStartRow, detailEndRow, referenceYear, 5),
    buildQuarterConditionalFormatting("K", renewalStartRow, renewalEndRow, referenceYear, 9),
    buildLinkedQuarterConditionalFormatting("L", "K", renewalStartRow, renewalEndRow, referenceYear, 13)
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A2:L${maxRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${buildColsXml()}</cols>
  <sheetData>${collapseRows(rows)}</sheetData>
  ${merged}
  ${conditionalFormatting}
  <tableParts count="3">
    <tablePart r:id="rId1"/>
    <tablePart r:id="rId2"/>
    <tablePart r:id="rId3"/>
  </tableParts>
</worksheet>`;
}

function buildTableRefs({ detailRows, assetCounts, renewalCounts }) {
  return {
    detailRef: `A3:F${Math.max(3, detailRows.length + 3)}`,
    assetRef: `H3:I${Math.max(3, assetCounts.length + 3)}`,
    renewalRef: `K3:L${Math.max(3, renewalCounts.length + 3)}`
  };
}

function appendRowCell(rows, rowNumber, cellXml) {
  const existingIndex = rows.findIndex((rowXml) => rowXml.startsWith(`<row r="${rowNumber}"`));
  if (existingIndex === -1) {
    return xmlRow(rowNumber, [cellXml]);
  }

  const existing = rows[existingIndex];
  rows.splice(existingIndex, 1);
  const updated = existing.replace("</row>", `${cellXml}</row>`);
  return updated;
}

function collapseRows(rows) {
  const byRow = new Map();
  for (const rowXml of rows) {
    const match = rowXml.match(/^<row r="(\d+)"/);
    if (!match) continue;
    byRow.set(Number(match[1]), rowXml);
  }
  return Array.from(byRow.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, value]) => value)
    .join("");
}

function buildColsXml() {
  return COLUMN_WIDTHS.map((width, index) => {
    const column = index + 1;
    return `<col min="${column}" max="${column}" width="${width}" customWidth="1"/>`;
  }).join("");
}

function buildDateConditionalFormatting(startRow, endRow, referenceYear, priorityStart) {
  const ref = `D${startRow}:D${endRow}`;
  return `<conditionalFormatting sqref="${ref}">
    <cfRule type="expression" dxfId="0" priority="${priorityStart}" stopIfTrue="1"><formula>IFERROR(YEAR(D${startRow})&lt;${referenceYear},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="1" priority="${priorityStart + 1}" stopIfTrue="1"><formula>IFERROR(YEAR(D${startRow})=${referenceYear},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="2" priority="${priorityStart + 2}" stopIfTrue="1"><formula>IFERROR(YEAR(D${startRow})=${referenceYear + 1},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="3" priority="${priorityStart + 3}" stopIfTrue="1"><formula>IFERROR(YEAR(D${startRow})&gt;${referenceYear + 1},FALSE)</formula></cfRule>
  </conditionalFormatting>`;
}

function buildQuarterConditionalFormatting(column, startRow, endRow, referenceYear, priorityStart) {
  const ref = `${column}${startRow}:${column}${endRow}`;
  return `<conditionalFormatting sqref="${ref}">
    <cfRule type="expression" dxfId="0" priority="${priorityStart}" stopIfTrue="1"><formula>IFERROR(VALUE(RIGHT(${column}${startRow},4))&lt;${referenceYear},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="1" priority="${priorityStart + 1}" stopIfTrue="1"><formula>IFERROR(VALUE(RIGHT(${column}${startRow},4))=${referenceYear},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="2" priority="${priorityStart + 2}" stopIfTrue="1"><formula>IFERROR(VALUE(RIGHT(${column}${startRow},4))=${referenceYear + 1},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="3" priority="${priorityStart + 3}" stopIfTrue="1"><formula>IFERROR(VALUE(RIGHT(${column}${startRow},4))&gt;${referenceYear + 1},FALSE)</formula></cfRule>
  </conditionalFormatting>`;
}

function buildLinkedQuarterConditionalFormatting(targetColumn, sourceColumn, startRow, endRow, referenceYear, priorityStart) {
  const ref = `${targetColumn}${startRow}:${targetColumn}${endRow}`;
  return `<conditionalFormatting sqref="${ref}">
    <cfRule type="expression" dxfId="0" priority="${priorityStart}" stopIfTrue="1"><formula>IFERROR(VALUE(RIGHT($${sourceColumn}${startRow},4))&lt;${referenceYear},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="1" priority="${priorityStart + 1}" stopIfTrue="1"><formula>IFERROR(VALUE(RIGHT($${sourceColumn}${startRow},4))=${referenceYear},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="2" priority="${priorityStart + 2}" stopIfTrue="1"><formula>IFERROR(VALUE(RIGHT($${sourceColumn}${startRow},4))=${referenceYear + 1},FALSE)</formula></cfRule>
    <cfRule type="expression" dxfId="3" priority="${priorityStart + 3}" stopIfTrue="1"><formula>IFERROR(VALUE(RIGHT($${sourceColumn}${startRow},4))&gt;${referenceYear + 1},FALSE)</formula></cfRule>
  </conditionalFormatting>`;
}

function xmlRow(rowNumber, cells, height) {
  const attrs = [`r="${rowNumber}"`];
  if (height) {
    attrs.push(`ht="${height}"`, 'customHeight="1"');
  }
  return `<row ${attrs.join(" ")}>${cells.join("")}</row>`;
}

function inlineCell(ref, value, styleIndex = 0) {
  return `<c r="${ref}" t="inlineStr" s="${styleIndex}"><is><t>${escapeXml(value)}</t></is></c>`;
}

function numberCell(ref, value, styleIndex = 0) {
  return `<c r="${ref}" s="${styleIndex}"><v>${Number(value)}</v></c>`;
}

function dateCell(ref, date, styleIndex = 0) {
  return `<c r="${ref}" s="${styleIndex}"><v>${dateToExcelSerial(date)}</v></c>`;
}

function dateToExcelSerial(date) {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>
  <Override PartName="/xl/tables/table2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>
  <Override PartName="/xl/tables/table3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;
}

function sheetRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table3.xml"/>
</Relationships>`;
}

function appXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>FortiSKU</Application>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>${escapeXml(sheetName)}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
</Properties>`;
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>FortiSKU</dc:creator>
  <cp:lastModifiedBy>FortiSKU</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function themeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F497D"/></a:dk2>
      <a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
      <a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
      <a:accent2><a:srgbClr val="C0504D"/></a:accent2>
      <a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
      <a:accent4><a:srgbClr val="8064A2"/></a:accent4>
      <a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
      <a:accent6><a:srgbClr val="F79646"/></a:accent6>
      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="800080"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:gradFill rotWithShape="1">
          <a:gsLst>
            <a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs>
            <a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs>
            <a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs>
          </a:gsLst>
          <a:lin ang="16200000" scaled="1"/>
        </a:gradFill>
        <a:gradFill rotWithShape="1">
          <a:gsLst>
            <a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="100000"/><a:shade val="100000"/><a:satMod val="130000"/></a:schemeClr></a:gs>
            <a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="50000"/><a:shade val="100000"/><a:satMod val="350000"/></a:schemeClr></a:gs>
          </a:gsLst>
          <a:lin ang="16200000" scaled="0"/>
        </a:gradFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill>
        <a:gradFill rotWithShape="1">
          <a:gsLst>
            <a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs>
            <a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs>
            <a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs>
          </a:gsLst>
          <a:path path="circle"><a:fillToRect l="50000" t="-80000" r="50000" b="180000"/></a:path>
        </a:gradFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="mm/dd/yy"/>
  </numFmts>
  <fonts count="3">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="14"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4F81BD"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFC0504D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9BBB59"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDA291C"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7F7F7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFC8C8C8"/></left>
      <right style="thin"><color rgb="FFC8C8C8"/></right>
      <top style="thin"><color rgb="FFC8C8C8"/></top>
      <bottom style="thin"><color rgb="FFC8C8C8"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="2" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="3" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  </cellXfs>
  <cellStyles count="4">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
    <cellStyle name="Accent1" xfId="1" builtinId="29"/>
    <cellStyle name="Accent2" xfId="2" builtinId="30"/>
    <cellStyle name="Accent3" xfId="3" builtinId="31"/>
  </cellStyles>
  <dxfs count="4">
    <dxf>
      <font><color rgb="00FFFFFF"/></font>
      <fill><patternFill patternType="solid"><fgColor rgb="00666666"/><bgColor rgb="00666666"/></patternFill></fill>
    </dxf>
    <dxf>
      <font><color rgb="009C0006"/></font>
      <fill><patternFill patternType="solid"><fgColor rgb="00FFC7CE"/><bgColor rgb="00FFC7CE"/></patternFill></fill>
    </dxf>
    <dxf>
      <font><color rgb="009C6500"/></font>
      <fill><patternFill patternType="solid"><fgColor rgb="00FFEB9C"/><bgColor rgb="00FFEB9C"/></patternFill></fill>
    </dxf>
    <dxf>
      <font><color rgb="00006100"/></font>
      <fill><patternFill patternType="solid"><fgColor rgb="00C6EFCE"/><bgColor rgb="00C6EFCE"/></patternFill></fill>
    </dxf>
  </dxfs>
</styleSheet>`;
}

function detailTableXml(ref) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="AssetDetail" displayName="AssetDetail" ref="${ref}" totalsRowShown="0">
  <autoFilter ref="${ref}"/>
  <tableColumns count="6">
    <tableColumn id="1" name="Serial Number"/>
    <tableColumn id="2" name="Product Model"/>
    <tableColumn id="3" name="Description"/>
    <tableColumn id="4" name="Unit Expiration Date"/>
    <tableColumn id="5" name="Quarter"/>
    <tableColumn id="6" name="Registration Date"/>
  </tableColumns>
  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`;
}

function assetCountTableXml(ref) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="2" name="AssetCountTbl" displayName="AssetCountTbl" ref="${ref}" totalsRowShown="0">
  <autoFilter ref="${ref}"/>
  <tableColumns count="2">
    <tableColumn id="1" name="Product Model"/>
    <tableColumn id="2" name="Count"/>
  </tableColumns>
  <tableStyleInfo name="TableStyleMedium4" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`;
}

function renewalTableXml(ref) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="3" name="QuarterCounts" displayName="QuarterCounts" ref="${ref}" totalsRowShown="0">
  <autoFilter ref="${ref}"/>
  <tableColumns count="2">
    <tableColumn id="1" name="Quarter"/>
    <tableColumn id="2" name="Count"/>
  </tableColumns>
  <tableStyleInfo name="TableStyleMedium3" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`;
}

function sanitizeFilenamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function utf8(text) {
  return new TextEncoder().encode(text);
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = utf8(file.path);
    const dataBytes = file.data instanceof Uint8Array ? file.data : utf8(String(file.data || ""));
    const crc = crc32(dataBytes);
    const dos = dosDateTime(new Date());

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dos.time, true);
    localView.setUint16(12, dos.date, true);
    localView.setUint32(14, crc >>> 0, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dos.time, true);
    centralView.setUint16(14, dos.date, true);
    centralView.setUint32(16, crc >>> 0, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localParts, ...centralParts, endRecord]);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
