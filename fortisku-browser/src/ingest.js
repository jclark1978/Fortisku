import { read, utils } from "../vendor/xlsx.mjs";

const DEFAULT_SHEET_NAME = "DataSet";

const FIELD_MAP = {
  sku: ["sku", "product_sku", "part", "partnumber"],
  description: ["description", "description#1", "description1", "desc", "itemdescription", "productdescription"],
  description2: ["description#2", "description2", "desc2", "itemdescription2", "productdescription2", "secondarydescription"],
  price: ["price", "listprice", "unitprice", "msrp", "usdprice"],
  category: ["category", "productcategory", "family", "productfamily", "familyname", "productline", "bundle", "solution", "segment", "portfolio"]
};

const HEADER_FIELDS = Object.keys(FIELD_MAP);

export async function ingestWorkbook(file, requestedSheetName) {
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
    throw new Error("Could not locate a header row containing SKU and Description #1 columns.");
  }

  const dataRows = rows.slice(headerInfo.index + 1);
  const { normalizedRows, stats } = normalizeRows(dataRows, headerInfo.headerMap);
  const coverInfo = extractCoverSheetInfo(workbook);

  if (!normalizedRows.length) {
    throw new Error("No data rows contained valid SKU and Description #1 values.");
  }

  return {
    rows: normalizedRows,
    sheetName,
    stats,
    coverInfo
  };
}

function extractCoverSheetInfo(workbook) {
  const sheetNames = workbook.SheetNames || [];
  const targets = ["cover sheet", "cover", "coversheet"];
  let sheet = null;
  for (const name of sheetNames) {
    const normalized = String(name).trim().toLowerCase();
    if (targets.includes(normalized)) {
      sheet = workbook.Sheets[name];
      break;
    }
  }

  if (!sheet) {
    return null;
  }

  const rows = sheet.__rows || [];
  const rowIndex = 6; // C7 -> zero-based row 6
  const colIndex = 2; // Column C -> zero-based index 2
  const row = rows[rowIndex];
  if (!row || row[colIndex] === undefined || row[colIndex] === null) {
    return null;
  }
  const value = String(row[colIndex]).trim();
  return value || null;
}

function findHeaderRow(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || !row.length) {
      continue;
    }
    const headerMap = mapHeaders(row);
    if (headerMap.includes("sku") && headerMap.includes("description")) {
      return { index, headerMap };
    }
  }
  return null;
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

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, "");
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
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === "")) {
      continue;
    }

    const record = {
      id: `row-${nextId++}`,
      sku: "",
      description: "",
      description2: "",
      price: null,
      price_display: "",
      category: ""
    };

    for (let colIndex = 0; colIndex < headerMap.length; colIndex++) {
      const field = headerMap[colIndex];
      if (!field) continue;

      const rawValue = row[colIndex];
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        continue;
      }

      if (field === "price") {
        const numeric = coercePrice(rawValue);
        if (numeric !== null) {
          record.price = numeric;
        }
        record.price_display = sanitizeString(rawValue);
        continue;
      }

      record[field] = sanitizeString(rawValue);
    }

    if (!record.sku || !record.description) {
      skippedRows++;
      continue;
    }

    record.sku = record.sku.trim();
    record.description = record.description.trim();
    record.description2 = record.description2.trim();
    record.price_display = record.price_display.trim();
    record.category = record.category.trim();

    normalizedRows.push(record);
  }

  normalizedRows.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: "base" }));

  return {
    normalizedRows,
    stats: {
      skippedRows
    }
  };
}

function sanitizeString(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function coercePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const cleaned = String(value)
    .replace(/[^0-9.-]+/g, "")
    .trim();
  if (!cleaned) return null;
  const numeric = parseFloat(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}
