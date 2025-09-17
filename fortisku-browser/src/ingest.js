import { read, utils } from "../vendor/xlsx.mjs";

const DEFAULT_SHEET_NAME = "DataSet";

const FIELD_MAP = {
  sku: ["sku", "product_sku", "part", "partnumber"],
  description: ["description", "description#1", "description1", "desc", "itemdescription", "productdescription"],
  description2: ["description#2", "description2", "desc2", "itemdescription2", "productdescription2", "secondarydescription"],
  price: ["price", "listprice", "unitprice", "msrp", "usdprice"],
  family: ["family"],
  model: ["model", "series", "appliance", "device", "platform"],
  bundle: ["bundle", "subscription", "license", "servicebundle", "package"],
  term: ["term", "duration", "years", "supportterm", "period"],
  version_date: ["versiondate", "effectivedate", "pricedate", "releasedate"]
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

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const headerMap = mapHeaders(headers);

  if (!headerMap.includes("sku") || !headerMap.includes("description")) {
    throw new Error("Required columns (SKU, Description #1) were not found in the header row.");
  }

  const { normalizedRows, stats } = normalizeRows(dataRows, headerMap);

  if (!normalizedRows.length) {
    throw new Error("No data rows contained valid SKU and Description #1 values.");
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
      family: "",
      model: "",
      bundle: "",
      term: "",
      version_date: ""
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
