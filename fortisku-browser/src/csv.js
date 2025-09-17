const HEADERS = ["sku", "description", "price", "family", "model", "bundle", "term", "version_date"];

export function rowsToCSV(rows) {
  const headerLine = HEADERS.join(",");
  const dataLines = rows.map((row) =>
    HEADERS.map((field) => escapeCsvValue(serializeField(row[field], field))).join(",")
  );

  return [headerLine, ...dataLines].join("\r\n");
}

function serializeField(value, field) {
  if (value === undefined || value === null) {
    return "";
  }
  if (field === "price" && typeof value === "number" && Number.isFinite(value)) {
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
