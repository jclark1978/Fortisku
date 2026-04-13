export function exportBomToCsv(bomState) {
  const items = bomState.items || [];
  const headers = [
    "sku",
    "description_1",
    "description_2",
    "comments",
    "unit_price",
    "quantity",
    "discount_percent",
    "line_total",
    "discounted_total"
  ];

  const lines = [headers.join(",")];

  let totalQuantity = 0;
  let listTotal = 0;
  let discountedTotal = 0;

  items.forEach((item) => {
    const quantity = clampQuantity(item.quantity);
    const unitPrice = toNumber(item.price);
    const discountPercent = clampDiscount(item.discountPercent);
    const lineTotal = unitPrice * quantity;
    const discounted = lineTotal * (1 - discountPercent / 100);

    totalQuantity += quantity;
    listTotal += lineTotal;
    discountedTotal += discounted;

    lines.push(
      [
        escapeCsv(item.sku),
        escapeCsv(item.description || ""),
        escapeCsv(item.description2 || ""),
        escapeCsv(item.comments || ""),
        formatMoney(unitPrice),
        quantity,
        formatPercent(discountPercent),
        formatMoney(lineTotal),
        formatMoney(discounted)
      ].join(",")
    );
  });

  lines.push(
    [
      "Totals",
      "",
      "",
      "",
      "",
      totalQuantity,
      "",
      formatMoney(listTotal),
      formatMoney(discountedTotal)
    ].join(",")
  );

  const csv = lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
  downloadBlob(`fortisku-bom-${timestamp}.csv`, blob);
}

function escapeCsv(value) {
  const stringValue = String(value);
  if (stringValue === "") {
    return "";
  }
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatMoney(value) {
  return toNumber(value).toFixed(2);
}

function formatPercent(value) {
  return clampDiscount(value).toFixed(2);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clampQuantity(quantity) {
  const numeric = Number(quantity);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 1;
  }
  return Math.round(numeric);
}

function clampDiscount(discount) {
  const numeric = Number(discount);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  if (numeric > 100) {
    return 100;
  }
  return Math.round(numeric * 100) / 100;
}

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
