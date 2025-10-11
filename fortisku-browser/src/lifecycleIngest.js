import { read, utils } from "../vendor/xlsx.mjs";

const DEFAULT_SHEET_NAME = "LifeCycle";

const FIELD_MAP = {
  product: ["product", "sku", "productcode", "product_id", "productid", "partnumber", "model"],
  category: ["category", "productcategory", "family", "segment", "portfolio"],
  end_of_order: ["endoforderdate", "lastorderdate", "lod", "eoo", "eolorder", "lastorder"],
  last_service: ["lastserviceextensiondate", "serviceextension", "lsed", "lastservice"],
  end_of_support: ["endofsupportdate", "eos", "supportenddate", "eol", "endoftac"]
};

const REQUIRED_FIELDS = ["product"];
const HEADER_FIELDS = Object.keys(FIELD_MAP);

export async function ingestLifecycleWorkbook(file, requestedSheetName) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = await read(arrayBuffer);
  const sheetName = resolveSheetName(workbook, requestedSheetName);
  if (!sheetName) {
    throw new Error(
      requestedSheetName
        ? `Sheet “${requestedSheetName}” not found. Available sheets: ${workbook.SheetNames.join(", ")}`
        : "Workbook does not contain any sheets."
    );
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json(worksheet, { header: 1 });

  if (!rows.length) {
    throw new Error(`Sheet “${sheetName}” is empty.`);
  }

  const headerInfo = findHeaderRow(rows);
  if (!headerInfo) {
    throw new Error("Could not locate a header row containing a Product column.");
  }

  const dataRows = rows.slice(headerInfo.index + 1);
  const { normalizedRows, stats } = normalizeRows(dataRows, headerInfo.headerMap);

  if (!normalizedRows.length) {
    throw new Error("No data rows contained a Product value.");
  }

  return {
    rows: normalizedRows,
    sheetName,
    stats
  };
}

function resolveSheetName(workbook, requested) {
  if (requested) {
    const directMatch = workbook.SheetNames.find((name) => name.toLowerCase() === requested.toLowerCase());
    if (directMatch) return directMatch;
  }
  const defaultMatch = workbook.SheetNames.find((name) => name.toLowerCase() === DEFAULT_SHEET_NAME.toLowerCase());
  if (defaultMatch) return defaultMatch;
  return workbook.SheetNames[0] || null;
}

function findHeaderRow(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || !row.length) continue;
    const headerMap = mapHeaders(row);
    const hasRequired = REQUIRED_FIELDS.every((field) => headerMap.includes(field));
    if (hasRequired) {
      return { index, headerMap };
    }
  }
  return null;
}

function mapHeaders(headers) {
  return headers.map((header) => {
    const normalized = normalizeKey(header);
    if (!normalized) return null;

    for (const field of HEADER_FIELDS) {
      if (normalized === field) {
        return field;
      }
    }

    for (const [field, synonyms] of Object.entries(FIELD_MAP)) {
      if (synonyms.includes(normalized)) {
        return field;
      }
    }

    for (const [field, synonyms] of Object.entries(FIELD_MAP)) {
      if (normalized.includes(field)) {
        return field;
      }
      if (synonyms.some((alias) => normalized.includes(alias))) {
        return field;
      }
    }

    return null;
  });
}

function normalizeRows(rows, headerMap) {
  const normalizedRows = [];
  let nextId = 1;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row || row.every((cell) => cell === undefined || cell === null || cell === "")) {
      continue;
    }

    const record = {
      id: `lc-row-${nextId++}`,
      product: "",
      category: "",
      endOfOrderDate: "",
      lastServiceExtensionDate: "",
      endOfSupportDate: ""
    };

    for (let colIndex = 0; colIndex < headerMap.length; colIndex += 1) {
      const field = headerMap[colIndex];
      if (!field) continue;

      const rawValue = row[colIndex];
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        continue;
      }

      switch (field) {
        case "product":
          record.product = sanitizeText(rawValue);
          break;
        case "category":
          record.category = sanitizeText(rawValue);
          break;
        case "end_of_order":
          record.endOfOrderDate = formatDateValue(rawValue);
          break;
        case "last_service":
          record.lastServiceExtensionDate = formatDateValue(rawValue);
          break;
        case "end_of_support":
          record.endOfSupportDate = formatDateValue(rawValue);
          break;
        default:
          break;
      }
    }

    if (!record.product) {
      skippedRows += 1;
      continue;
    }

    normalizedRows.push(record);
  }

  return {
    normalizedRows,
    stats: {
      totalRows: rows.length,
      skippedRows
    }
  };
}

function formatDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return toISODate(value);
  }
  if (typeof value === "number") {
    const parsed = fromExcelSerial(value);
    return parsed ? toISODate(parsed) : "";
  }
  const text = sanitizeText(value);
  if (!text) return "";
  const parsed = parseDateString(text);
  return parsed ? toISODate(parsed) : text;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function fromExcelSerial(serial) {
  if (!Number.isFinite(serial)) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const millis = Math.round(serial * 86400000);
  if (!Number.isFinite(millis)) return null;
  return new Date(epoch.getTime() + millis);
}

function parseDateString(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed;
}

function sanitizeText(value) {
  return String(value ?? "").trim();
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
