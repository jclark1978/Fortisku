const NUMBER_FORMAT_PERCENT = "0.00%";
const NUMBER_FORMAT_INTEGER = "0";
const NUMBER_FORMAT_CURRENCY = "$#,##0.00";

export function exportBomToXlsx(bomState) {
  const blob = createWorkbookBlob(bomState.items || []);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
  const filename = `fortisku-bom-${timestamp}.xlsx`;
  downloadBlob(filename, blob);
}

function createWorkbookBlob(items) {
  const sheetXml = buildSheetXml(items);
  const files = [
    { name: "[Content_Types].xml", data: stringToBytes(CONTENT_TYPES_XML) },
    { name: "_rels/.rels", data: stringToBytes(ROOT_RELS_XML) },
    { name: "xl/workbook.xml", data: stringToBytes(WORKBOOK_XML) },
    { name: "xl/_rels/workbook.xml.rels", data: stringToBytes(WORKBOOK_RELS_XML) },
    { name: "xl/styles.xml", data: stringToBytes(STYLES_XML) },
    { name: "xl/worksheets/sheet1.xml", data: stringToBytes(sheetXml) }
  ];
  return createZipBlob(files);
}

function buildSheetXml(items) {
  let rowIndex = 1;
  const rows = [];
  rows.push(buildHeaderRow(rowIndex++));

  items.forEach((item) => {
    rows.push(buildDataRow(rowIndex++, item));
  });

  rows.push(buildTotalRow(rowIndex, items.length));

  const sheetDimension = `A1:I${Math.max(rowIndex, 2)}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${sheetDimension}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>
${rows.map((row) => `    ${row}`).join("\n")}
  </sheetData>
</worksheet>`;
}

function buildHeaderRow(row) {
  const headers = [
    "SKU",
    "Description #1",
    "Description #2",
    "Comments",
    "Unit Price",
    "Quantity",
    "Discount %",
    "Line Total",
    "Discounted Total"
  ];
  const cells = headers.map((value, index) => inlineStringCell(index + 1, row, value, 1));
  return `<row r="${row}">${cells.join('')}</row>`;
}

function buildDataRow(row, item) {
  const cells = [
    inlineStringCell(1, row, item.sku, 0),
    inlineStringCell(2, row, item.description || "", 0),
    inlineStringCell(3, row, item.description2 || "", 0),
    inlineStringCell(4, row, item.comments || "", 0),
    numberCell(5, row, Number(item.price) || 0, 3),
    numberCell(6, row, Number(item.quantity) || 0, 2),
    numberCell(7, row, (Number(item.discountPercent) || 0) / 100, 4),
    formulaCell(8, row, `E${row}*F${row}`, 3),
    formulaCell(9, row, `E${row}*F${row}*(1-G${row})`, 3)
  ];
  return `<row r="${row}">${cells.join('')}</row>`;
}

function buildTotalRow(row, itemCount) {
  const firstData = 2;
  const lastData = itemCount ? itemCount + 1 : firstData - 1;
  const rangeOrCell = (column) => (lastData >= firstData ? `${column}${firstData}:${column}${lastData}` : `${column}${firstData}`);

  const cells = [
    inlineStringCell(1, row, "Totals", 1),
    emptyCell(2, row),
    emptyCell(3, row),
    emptyCell(4, row),
    emptyCell(5, row),
    formulaCell(6, row, `SUM(${rangeOrCell('F')})`, 2),
    emptyCell(7, row),
    formulaCell(8, row, `SUM(${rangeOrCell('H')})`, 3),
    formulaCell(9, row, `SUM(${rangeOrCell('I')})`, 3)
  ];
  return `<row r="${row}">${cells.join('')}</row>`;
}

function inlineStringCell(column, row, value, style) {
  return `<c r="${colRef(column)}${row}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t>${escapeXml(value || "")}</t></is></c>`;
}

function numberCell(column, row, value, style) {
  const numeric = Number(value);
  return `<c r="${colRef(column)}${row}"${style ? ` s="${style}"` : ""}><v>${Number.isFinite(numeric) ? numeric : 0}</v></c>`;
}

function formulaCell(column, row, formula, style) {
  return `<c r="${colRef(column)}${row}"${style ? ` s="${style}"` : ""}><f>${escapeXml(formula)}</f></c>`;
}

function emptyCell(column, row) {
  return `<c r="${colRef(column)}${row}"/>`;
}

function colRef(index) {
  let n = index;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return char;
    }
  });
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="BOM" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="${NUMBER_FORMAT_CURRENCY}"/>
    <numFmt numFmtId="165" formatCode="${NUMBER_FORMAT_PERCENT}"/>
    <numFmt numFmtId="166" formatCode="${NUMBER_FORMAT_INTEGER}"/>
  </numFmts>
  <fonts count="1"><font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

function createZipBlob(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = stringToBytes(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    let pointer = 0;
    localView.setUint32(pointer, 0x04034b50, true); pointer += 4;
    localView.setUint16(pointer, 20, true); pointer += 2;
    localView.setUint16(pointer, 0, true); pointer += 2;
    localView.setUint16(pointer, 0, true); pointer += 2;
    localView.setUint16(pointer, 0, true); pointer += 2;
    localView.setUint16(pointer, 0, true); pointer += 2;
    localView.setUint32(pointer, crc >>> 0, true); pointer += 4;
    localView.setUint32(pointer, data.length, true); pointer += 4;
    localView.setUint32(pointer, data.length, true); pointer += 4;
    localView.setUint16(pointer, nameBytes.length, true); pointer += 2;
    localView.setUint16(pointer, 0, true); pointer += 2;
    localHeader.set(nameBytes, pointer);

    chunks.push(localHeader);
    chunks.push(data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    pointer = 0;
    centralView.setUint32(pointer, 0x02014b50, true); pointer += 4;
    centralView.setUint16(pointer, 20, true); pointer += 2;
    centralView.setUint16(pointer, 20, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint32(pointer, crc >>> 0, true); pointer += 4;
    centralView.setUint32(pointer, data.length, true); pointer += 4;
    centralView.setUint32(pointer, data.length, true); pointer += 4;
    centralView.setUint16(pointer, nameBytes.length, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint16(pointer, 0, true); pointer += 2;
    centralView.setUint32(pointer, 0, true); pointer += 4;
    centralView.setUint32(pointer, offset, true); pointer += 4;
    centralHeader.set(nameBytes, pointer);

    central.push(centralHeader);

    offset += localHeader.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  central.forEach((entry) => chunks.push(entry));
  offset += centralSize;

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);
  chunks.push(endRecord);

  return new Blob(chunks, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c >>>= 1;
      }
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
