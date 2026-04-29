export function buildPricingDataset(rows, meta) {
  const sharedRows = rows.map((row) => ({
    sku: row.sku,
    description1: row.description,
    description2: row.description2,
    price: row.price,
    priceDisplay: row.price_display,
    category: row.category,
    comments: row.comments
  }));

  return {
    key: "pricing",
    version: 1,
    source: {
      app: "FortiSKU",
      format: "xlsx",
      label: meta.priceListLabel ?? null,
      importedAt: meta.updatedAt,
      effectiveDate: null
    },
    data: {
      rows: sharedRows
    },
    meta: {
      rowCount: sharedRows.length,
      schema: "toolbox_shared.pricing.v1"
    }
  };
}
