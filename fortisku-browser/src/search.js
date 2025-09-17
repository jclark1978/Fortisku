import MiniSearch from "../vendor/minisearch.min.js";

const SEARCH_FIELDS = ["sku", "description", "family", "model", "bundle", "term"];
const STORE_FIELDS = ["sku", "description", "price", "family", "model", "bundle", "term", "version_date"];

export function createSearchIndex(rows) {
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

export function loadSearchIndex(json) {
  return MiniSearch.loadJSON(json);
}

export function tokenizeQuery(query) {
  if (!query) return [];
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

export function searchRows(index, rowsById, tokens, limit) {
  if (!index || !tokens.length) {
    return {
      hits: [],
      total: 0
    };
  }

  const queryString = tokens.join(" ");
  const results = index.search(queryString, {
    combineWith: "AND",
    prefix: true
  });

  const firstToken = tokens[0] || "";
  const enriched = results
    .map((result) => {
      const row = rowsById.get(result.id);
      if (!row) return null;
      const skuStarts = firstToken ? row.sku.toLowerCase().startsWith(firstToken) : false;
      return {
        row,
        skuStarts,
        score: result.score
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.skuStarts !== b.skuStarts) {
        return a.skuStarts ? -1 : 1;
      }
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.row.description.localeCompare(b.row.description);
    });

  const limited = enriched.slice(0, limit).map((entry) => entry.row);

  return {
    hits: limited,
    total: enriched.length
  };
}
