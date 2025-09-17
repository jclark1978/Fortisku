const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function exportBomToXlsx(bomState) {
  const blob = createWorkbookBlob(bomState.items || []);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
  const filename = `fortisku-bom-${timestamp}.xlsx`;
  downloadBlob(filename, blob);
}

function createWorkbookBlob(items) {
  const sheetXml = buildSheetXml(items);
  const files = [
    { name: '[Content_Types].xml', data: stringToUint8(contentTypesXml) },
    { name: '_rels/.rels', data: stringToUint8(rootRelsXml) },
    { name: 'xl/workbook.xml', data: stringToUint8(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: stringToUint8(workbookRelsXml) },
    { name: 'xl/worksheets/sheet1.xml', data: stringToUint8(sheetXml) }
  ];
  return createZipBlob(files);
}

function buildSheetXml(items) {
  let rowIndex = 1;
  const rows = [];
  rows.push(buildHeaderRow(rowIndex++, ['SKU', 'Description #1', 'Description #2', 'Comments', 'Unit Price', 'Quantity', 'Discount %', 'Line Total', 'Discounted Total']));

  items.forEach((item) => {
    rows.push(buildDataRow(rowIndex++, item));
  });

  rows.push(buildTotalRow(rowIndex, items.length));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n  <sheetViews><sheetView workbookViewId="0"/></sheetViews>\n  <sheetFormatPr defaultRowHeight="15"/>\n  <sheetData>\n    ${rows.join('\n    ')}\n  </sheetData>\n</worksheet>`;
}

function buildHeaderRow(index, values) {
  const cells = values.map((value, i) => `<c r="${colRef(i + 1)}${index}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`);
  return `<row r="${index}">${cells.join('')}</row>`;
}

function buildDataRow(index, item) {
  const rowRef = index;
  const lineTotalFormula = `E${rowRef}*F${rowRef}`;
  const discountedFormula = `E${rowRef}*F${rowRef}*(1-G${rowRef})`;
  const cells = [
    inlineStrCell(1, rowRef, item.sku),
    inlineStrCell(2, rowRef, item.description || ''),
    inlineStrCell(3, rowRef, item.description2 || ''),
    inlineStrCell(4, rowRef, item.comments || ''),
    numberCell(5, rowRef, item.price),
    numberCell(6, rowRef, item.quantity),
    numberCell(7, rowRef, (Number(item.discountPercent) || 0) / 100),
    formulaCell(8, rowRef, lineTotalFormula),
    formulaCell(9, rowRef, discountedFormula)
  ];
  return `<row r="${rowRef}">${cells.join('')}</row>`;
}

function buildTotalRow(rowIndex, itemCount) {
  const firstDataRow = 2;
  const lastDataRow = itemCount ? itemCount + 1 : firstDataRow - 1;
  const rangeOrSelf = (column) => {
    if (lastDataRow < firstDataRow) {
      return `${column}${firstDataRow}`;
    }
    return `${column}${firstDataRow}:${column}${lastDataRow}`;
  };
  return `<row r="${rowIndex}">`
    + inlineStrCell(1, rowIndex, 'Totals')
    + emptyCell(2, rowIndex)
    + emptyCell(3, rowIndex)
    + emptyCell(4, rowIndex)
    + emptyCell(5, rowIndex)
    + formulaCell(6, rowIndex, `SUM(${rangeOrSelf('F')})`)
    + emptyCell(7, rowIndex)
    + formulaCell(8, rowIndex, `SUM(${rangeOrSelf('H')})`)
    + formulaCell(9, rowIndex, `SUM(${rangeOrSelf('I')})`)
    + `</row>`;
}

function inlineStrCell(column, row, value) {
  return `<c r="${colRef(column)}${row}" t="inlineStr"><is><t>${escapeXml(value || '')}</t></is></c>`;
}

function numberCell(column, row, value) {
  const numeric = Number(value);
  return `<c r="${colRef(column)}${row}"><v>${Number.isFinite(numeric) ? numeric : 0}</v></c>`;
}

function formulaCell(column, row, formula) {
  return `<c r="${colRef(column)}${row}"><f>${escapeXml(formula)}</f></c>`;
}

function emptyCell(column, row) {
  return `<c r="${colRef(column)}${row}"/>`;
}

function colRef(index) {
  let n = index;
  let col = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="BOM" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

function stringToUint8(str) {
  return new TextEncoder().encode(str);
}

function createZipBlob(files) {
  const centralDirectory = [];
  let offset = 0;
  const chunks = [];

  files.forEach((file) => {
    const local = createLocalHeader(file.name, file.data);
    chunks.push(local.header);
    chunks.push(file.data);

    const central = createCentralHeader(file.name, file.data, offset);
    centralDirectory.push(central);

    offset += local.header.length + file.data.length;
  });

  const centralOffset = offset;
  centralDirectory.forEach((entry) => {
    chunks.push(entry);
    offset += entry.length;
  });

  const endRecord = createEndRecord(files.length, centralDirectory, centralOffset);
  chunks.push(endRecord);

  return new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function createLocalHeader(name, data) {
  const nameBytes = stringToUint8(name);
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  const crc = crc32(data);

  let offset = 0;
  view.setUint32(offset, 0x04034b50, true); offset += 4;
  view.setUint16(offset, 20, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint32(offset, crc >>> 0, true); offset += 4;
  view.setUint32(offset, data.length, true); offset += 4;
  view.setUint32(offset, data.length, true); offset += 4;
  view.setUint16(offset, nameBytes.length, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  header.set(nameBytes, offset);

  return { header, crc };
}

function createCentralHeader(name, data, localOffset) {
  const nameBytes = stringToUint8(name);
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  const crc = crc32(data);

  let offset = 0;
  view.setUint32(offset, 0x02014b50, true); offset += 4;
  view.setUint16(offset, 20, true); offset += 2;
  view.setUint16(offset, 20, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint32(offset, crc >>> 0, true); offset += 4;
  view.setUint32(offset, data.length, true); offset += 4;
  view.setUint32(offset, data.length, true); offset += 4;
  view.setUint16(offset, nameBytes.length, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint32(offset, 0, true); offset += 4;
  view.setUint32(offset, localOffset, true); offset += 4;
  header.set(nameBytes, offset);

  return header;
}

function createEndRecord(fileCount, centralDirectory, centralOffset) {
  const totalCentralSize = centralDirectory.reduce((sum, entry) => sum + entry.length, 0);
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, totalCentralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);

  return record;
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC32_TABLE = (() => {
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
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
