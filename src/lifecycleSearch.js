import MiniSearch from "../vendor/minisearch.min.js";

const SEARCH_FIELDS = ["product"];
const STORE_FIELDS = [
  "product",
  "category",
  "endOfOrderDate",
  "lastServiceExtensionDate",
  "endOfSupportDate"
];

export function createLifecycleSearchIndex(rows) {
  const miniSearch = new MiniSearch({
    fields: SEARCH_FIELDS,
    storeFields: STORE_FIELDS,
    idField: "id",
    searchOptions: {
      combineWith: "AND",
      prefix: true
    }
  });

  miniSearch.addAll(rows);
  return {
    index: miniSearch,
    exported: miniSearch.toJSON()
  };
}

export function loadLifecycleSearchIndex(json) {
  return MiniSearch.loadJSON(json);
}

export function searchLifecycleRows(index, rowsById, query, limit) {
  if (!index) {
    return {
      hits: [],
      total: 0
    };
  }

  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return {
      hits: [],
      total: rowsById?.size ?? 0
    };
  }

  const rawResults = index.search(normalizedQuery, {
    combineWith: "AND",
    prefix: true
  });

  const uniqueMatches = [];
  const seen = new Set();

  for (const result of rawResults) {
    if (seen.has(result.id)) continue;
    const row = rowsById.get(result.id);
    if (!row) continue;
    seen.add(result.id);
    uniqueMatches.push(row);
  }

  const limited = typeof limit === "number" && limit > 0 ? uniqueMatches.slice(0, limit) : uniqueMatches;

  return {
    hits: limited,
    total: uniqueMatches.length
  };
}

function normalizeQuery(value) {
  if (!value) return "";
  return String(value).trim();
}
