const HEADERS = [
  { key: "sku", label: "sku" },
  { key: "description", label: "description_1" },
  { key: "description2", label: "description_2" },
  { key: "price", label: "price" },
  { key: "category", label: "category" }
];

export function rowsToCSV(rows) {
  const headerLine = HEADERS.map((h) => h.label).join(",");
  const dataLines = rows.map((row) =>
    HEADERS.map(({ key }) => escapeCsvValue(serializeField(row, key))).join(",")
  );

  return [headerLine, ...dataLines].join("\r\n");
}

function serializeField(row, key) {
  const value = row[key];
  if (value === undefined || value === null) {
    if (key === "price" && row.price_display) {
      return row.price_display;
    }
    return "";
  }
  if (key === "price" && typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return String(value);
}

function escapeCsvValue(value) {
  if (value === "") {
    return "";
  }
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
