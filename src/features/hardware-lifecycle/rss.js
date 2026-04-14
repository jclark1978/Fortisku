export function parseLifecycleRssText(xmlText) {
  const source = String(xmlText || "").trim();
  if (!source) {
    throw new Error("RSS XML file is empty.");
  }

  const channel = matchTag(source, "channel");
  if (!channel) {
    throw new Error("Could not find an RSS channel in the XML file.");
  }

  const feedTitle = cleanupText(matchTag(channel, "title")) || "Fortinet Product Lifecycle RSS";
  const feedUpdatedAt = cleanupText(matchTag(channel, "lastBuildDate"));
  const itemMatches = source.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  if (!itemMatches.length) {
    throw new Error("No RSS items were found in the XML file.");
  }

  const rows = [];
  let skippedRows = 0;

  itemMatches.forEach((itemXml, index) => {
    const product = cleanupText(matchTag(itemXml, "title"));
    const descriptionMarkup = matchTag(itemXml, "description");
    const description = normalizeDescription(descriptionMarkup);
    const fields = extractDescriptionFields(description);

    if (!product) {
      skippedRows += 1;
      return;
    }

    rows.push({
      id: `lcr-row-${index + 1}`,
      product,
      category: fields.category,
      endOfOrderDate: fields.endOfOrderDate,
      lastServiceExtensionDate: fields.lastServiceExtensionDate,
      endOfSupportDate: fields.endOfSupportDate
    });
  });

  if (!rows.length) {
    throw new Error("No lifecycle products could be parsed from the XML file.");
  }

  return {
    rows,
    meta: {
      feedTitle,
      feedUpdatedAt,
      rowCount: rows.length,
      skippedRows
    }
  };
}

function matchTag(source, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = pattern.exec(source);
  return match ? match[1] : "";
}

function normalizeDescription(value) {
  return cleanupText(
    String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s*,\s*\n/g, "\n")
  );
}

function extractDescriptionFields(description) {
  return {
    category: extractLabeledValue(description, "Category"),
    endOfOrderDate: extractLabeledValue(description, "End of Order"),
    lastServiceExtensionDate: extractLabeledValue(description, "Last Service Extension"),
    endOfSupportDate: extractLabeledValue(description, "End of Support")
  };
}

function extractLabeledValue(source, label) {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*:\\s*([^\\n]+)`, "i");
  const match = pattern.exec(source);
  return cleanupText(match ? match[1] : "");
}

function cleanupText(value) {
  return decodeEntities(String(value || ""))
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
