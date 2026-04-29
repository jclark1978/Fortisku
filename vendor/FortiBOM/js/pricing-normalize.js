// Pricing normalization utilities — shared row schema for toolbox_shared.pricing.v1
//
// Normalized pricing row shape:
//   { sku, description1, description2, price, priceDisplay, category, comments }

const PRICING_HEADER_MAP = {
  sku:          ['sku', 'product_sku', 'part', 'partnumber'],
  description1: ['description', 'description#1', 'description1', 'desc', 'itemdescription', 'productdescription'],
  description2: ['description#2', 'description2', 'desc2', 'itemdescription2', 'productdescription2', 'secondarydescription'],
  price:        ['price', 'listprice', 'unitprice', 'msrp', 'usdprice'],
  category:     ['category', 'productcategory', 'family', 'productfamily', 'familyname', 'productline', 'bundle', 'solution', 'segment', 'portfolio'],
  comments:     ['comments', 'comment', 'notes', 'note'],
};

function _pnNormalKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9#]/g, '');
}

function _pnResolveColumnMap(sampleKeys) {
  const result = {};
  sampleKeys.forEach(key => {
    const norm = _pnNormalKey(key);
    for (const [field, synonyms] of Object.entries(PRICING_HEADER_MAP)) {
      if (result[field]) continue;
      if (synonyms.some(s => _pnNormalKey(s) === norm)) {
        result[field] = key;
        break;
      }
    }
  });
  return result;
}

function normalizePricingRows(rawRows) {
  if (!rawRows || !rawRows.length) return [];

  const colMap = _pnResolveColumnMap(Object.keys(rawRows[0]));

  return rawRows
    .map(raw => {
      const get = field => {
        const key = colMap[field];
        return key !== undefined ? String(raw[key] !== undefined ? raw[key] : '').trim() : '';
      };
      const priceRaw = get('price');
      const priceNum = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : NaN;
      return {
        sku:          get('sku').toUpperCase(),
        description1: get('description1'),
        description2: get('description2'),
        price:        isNaN(priceNum) ? null : priceNum,
        priceDisplay: priceRaw,
        category:     get('category'),
        comments:     get('comments'),
      };
    })
    .filter(r => r.sku)
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

function buildPricingEnvelope(normalizedRows, sourceMeta) {
  return {
    key:     TOOLBOX_KEY_PRICING,
    version: 1,
    source: {
      app:           sourceMeta.app           || 'FabricBOM',
      format:        sourceMeta.format        || 'xlsx',
      label:         sourceMeta.label         || null,
      importedAt:    sourceMeta.importedAt    || new Date().toISOString(),
      effectiveDate: sourceMeta.effectiveDate || null,
    },
    data: {
      rows: normalizedRows,
    },
    meta: {
      rowCount: normalizedRows.length,
      schema:   'toolbox_shared.pricing.v1',
    },
  };
}
