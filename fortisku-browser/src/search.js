import MiniSearch from "../vendor/minisearch.min.js";

const SEARCH_FIELDS = ["description", "description2"];
const STORE_FIELDS = [
  "sku",
  "description",
  "description2",
  "price",
  "price_display",
  "category",
  "comments"
];

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

export function parseQuery(raw) {
  if (!raw || !raw.trim()) {
    return { groups: [], firstTerm: "" };
  }

  try {
    const parser = new QueryParser(raw);
    const groups = dedupeGroups(parser.parse());
    if (!groups.length) {
      return { groups: [], firstTerm: "" };
    }
    return {
      groups,
      firstTerm: parser.firstTerm || groups[0]?.[0] || ""
    };
  } catch (error) {
    const fallback = fallbackTokenize(raw);
    return {
      groups: fallback.length ? [fallback] : [],
      firstTerm: fallback[0] || ""
    };
  }
}

export function searchRows(index, rowsById, parsedQuery, limit) {
  if (!index || !parsedQuery?.groups?.length) {
    return {
      hits: [],
      total: 0
    };
  }

  const matches = new Map();

  for (const group of parsedQuery.groups) {
    if (!group.length) continue;
    const queryString = group.join(" ");
    const results = index.search(queryString, {
      combineWith: "AND",
      prefix: true
    });

    for (const result of results) {
      const row = rowsById.get(result.id);
      if (!row) continue;

      const existing = matches.get(result.id);
      if (existing) {
        existing.score = Math.max(existing.score, result.score);
        existing.groupsMatched += 1;
      } else {
        matches.set(result.id, {
          row,
          score: result.score,
          groupsMatched: 1
        });
      }
    }
  }

  const firstTerm = parsedQuery.firstTerm?.toLowerCase() || "";

  const aggregated = Array.from(matches.values()).map((entry) => {
    const primaryStarts = firstTerm
      ? (entry.row.description || "").toLowerCase().startsWith(firstTerm)
      : false;
    const secondaryStarts = firstTerm
      ? (entry.row.description2 || "").toLowerCase().startsWith(firstTerm)
      : false;
    return {
      row: entry.row,
      score: entry.score,
      groupsMatched: entry.groupsMatched,
      primaryStarts,
      secondaryStarts,
      descriptionStarts: primaryStarts || secondaryStarts
    };
  });

  aggregated.sort((a, b) => {
    if (a.descriptionStarts !== b.descriptionStarts) {
      return a.descriptionStarts ? -1 : 1;
    }
    if (a.primaryStarts !== b.primaryStarts) {
      return a.primaryStarts ? -1 : 1;
    }
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    if (a.groupsMatched !== b.groupsMatched) {
      return b.groupsMatched - a.groupsMatched;
    }
    return a.row.description.localeCompare(b.row.description);
  });

  const limited = aggregated.slice(0, limit).map((entry) => entry.row);

  return {
    hits: limited,
    total: aggregated.length
  };
}

function fallbackTokenize(raw) {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => normalizeToken(token));
}

function normalizeToken(token) {
  return token.toLowerCase();
}

function dedupeGroups(groups) {
  const seen = new Set();
  const result = [];

  for (const group of groups) {
    const uniqueGroup = Array.from(new Set(group));
    if (!uniqueGroup.length) continue;
    const key = uniqueGroup.join("\u0000");
    if (!seen.has(key)) {
      seen.add(key);
      result.push(uniqueGroup);
    }
  }

  return result;
}

class QueryParser {
  constructor(input) {
    this.tokens = lex(input);
    this.position = 0;
    this.firstTerm = "";
  }

  parse() {
    const groups = this.parseExpression();
    if (this.peek()) {
      throw new Error(`Unexpected token: ${this.peek().value}`);
    }
    return groups;
  }

  parseExpression() {
    let groups = this.parseTerm();
    while (this.matchOr()) {
      const rhs = this.parseTerm();
      groups = combineOr(groups, rhs);
    }
    return groups;
  }

  parseTerm() {
    let groups = [[]];
    let consumed = false;

    while (true) {
      const token = this.peek();
      if (!token || token.type === "RPAREN" || token.type === "OR") {
        break;
      }
      const factorGroups = this.parseFactor();
      groups = combineAnd(groups, factorGroups);
      consumed = true;
    }

    return consumed ? groups : [[]];
  }

  parseFactor() {
    const token = this.peek();
    if (!token) {
      return [[]];
    }

    if (token.type === "LPAREN") {
      this.advance();
      const groups = this.parseExpression();
      if (!this.match("RPAREN")) {
        throw new Error("Unmatched parenthesis");
      }
      return groups;
    }

    if (token.type === "WORD") {
      const word = normalizeToken(this.advance().value);
      if (!this.firstTerm) {
        this.firstTerm = word;
      }
      return [[word]];
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  match(type) {
    const token = this.peek();
    if (token && token.type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  matchOr() {
    return this.match("OR");
  }

  peek() {
    return this.tokens[this.position];
  }

  advance() {
    return this.tokens[this.position++];
  }
}

function combineOr(left, right) {
  if (!left.length) return right;
  if (!right.length) return left;
  return [...left, ...right];
}

function combineAnd(left, right) {
  if (!left.length) return right;
  if (!right.length) return left;
  const combinations = [];
  for (const a of left) {
    for (const b of right) {
      combinations.push(mergeUnique(a, b));
    }
  }
  return combinations;
}

function mergeUnique(left, right) {
  const seen = new Set();
  const result = [];
  for (const token of [...left, ...right]) {
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}

function lex(input) {
  const tokens = [];
  const regex = /"([^"]+)"|\(|\)|\bOR\b|\|\||\||[^\s()|]+/gi;
  let match;

  while ((match = regex.exec(input)) !== null) {
    if (match[1]) {
      tokens.push({ type: "WORD", value: match[1] });
      continue;
    }

    const raw = match[0];
    const lower = raw.toLowerCase();

    if (lower === "(") {
      tokens.push({ type: "LPAREN", value: raw });
    } else if (lower === ")") {
      tokens.push({ type: "RPAREN", value: raw });
    } else if (lower === "or" || lower === "|" || lower === "||") {
      tokens.push({ type: "OR", value: raw });
    } else {
      tokens.push({ type: "WORD", value: raw });
    }
  }

  return tokens;
}
