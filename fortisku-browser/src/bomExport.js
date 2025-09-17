import XLSX from "../vendor/xlsx.mjs";

export function exportBomToXlsx(bomState) {
  const workbook = XLSX.utils.book_new();
  const header = [
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

  const data = [header];
  const items = bomState.items || [];

  items.forEach((item, index) => {
    const rowNumber = index + 2;
    const discountValue = (Number(item.discountPercent) || 0) / 100;
    data.push([
      item.sku,
      item.description || "",
      item.description2 || "",
      item.comments || "",
      item.price,
      item.quantity,
      discountValue,
      { f: `E${rowNumber}*F${rowNumber}` },
      { f: `E${rowNumber}*F${rowNumber}*(1-G${rowNumber})` }
    ]);
  });

  const startDataRow = 2;
  const lastDataRow = items.length ? items.length + 1 : startDataRow - 1;
  const totalRowIndex = lastDataRow + 1;

  data.push([
    "Totals",
    "",
    "",
    "",
    "",
    { f: `SUM(F${startDataRow}:F${lastDataRow})` },
    "",
    { f: `SUM(H${startDataRow}:H${lastDataRow})` },
    { f: `SUM(I${startDataRow}:I${lastDataRow})` }
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 38 },
    { wch: 32 },
    { wch: 40 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 18 }
  ];

  applyFormats(worksheet, items.length);

  XLSX.utils.book_append_sheet(workbook, worksheet, "BOM");

  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
  const filename = `fortisku-bom-${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

function applyFormats(ws, itemCount) {
  const headerRow = 1;
  for (let col = 0; col < 9; col += 1) {
    const cellAddress = XLSX.utils.encode_cell({ c: col, r: headerRow - 1 });
    const cell = ws[cellAddress];
    if (cell) {
      cell.s = { font: { bold: true } };
    }
  }

  const startRow = 2;
  const endRow = itemCount ? itemCount + 1 : startRow - 1;

  for (let r = startRow; r <= endRow; r += 1) {
    setCurrency(ws, `E${r}`);
    setInteger(ws, `F${r}`);
    setPercent(ws, `G${r}`);
    setCurrency(ws, `H${r}`);
    setCurrency(ws, `I${r}`);
  }

  const totalRow = endRow + 1;
  setInteger(ws, `F${totalRow}`);
  setCurrency(ws, `H${totalRow}`);
  setCurrency(ws, `I${totalRow}`);
  const totalLabel = ws[`A${totalRow}`];
  if (totalLabel) {
    totalLabel.s = { font: { bold: true } };
  }
}

function setCurrency(ws, address) {
  const cell = ws[address];
  if (!cell) return;
  cell.t = 'n';
  cell.z = "$#,##0.00";
}

function setInteger(ws, address) {
  const cell = ws[address];
  if (!cell) return;
  cell.t = 'n';
  cell.z = "0";
}

function setPercent(ws, address) {
  const cell = ws[address];
  if (!cell) return;
  cell.t = 'n';
  cell.z = "0.00%";
}
