## Scope

This document defines the dataset-specific IndexedDB specification for storing Asset Report workbook data in the shared browser-side IndexedDB format used by the Toolbox application suite.

The shared IndexedDB database and object store are common across all shared datasets. This document defines only the Asset Report dataset module that lives inside that shared storage container.

Other datasets may also be stored in the same shared IndexedDB database, but each dataset must have its own separate specification defining its dataset key, record shape, validation rules, import behavior, metadata, and compatibility requirements.

The Asset Report dataset is stored under the unique dataset key `asset_reports`. This key is reserved for the Asset Report inventory dataset and must not be reused by any other dataset.

Importing or replacing the Asset Report dataset must only update the record with key `asset_reports`. It must not delete, overwrite, migrate, or modify other records in the `datasets` object store.

This document defines:

- The shared IndexedDB database name and version
- The shared object store name and configuration
- The `onupgradeneeded` initialization behavior
- The Asset Report dataset key
- The Asset Report record shape
- Required workbook headers
- Row formatting and date normalization rules
- Workbook import rules
- Valid `source.type` values
- Dataset metadata requirements
- Compatibility rules for joining with `hardware_lifecycle`
- Versioning expectations
- How to read the dataset from other applications

This document does not define schemas for unrelated datasets. Future datasets should be documented in separate dataset-specific specification documents that follow the same modular pattern.

## IndexedDB Asset Report Dataset Specification

### 1. IndexedDB Name
```
toolbox_shared
```

### 2. IndexedDB Version

Open the database with version `2`:

```javascript
const req = indexedDB.open('toolbox_shared', 2);
```

The top-level `version` field inside each dataset record (for example `{ key: "asset_reports", version: 1, ... }`) is the schema version for that specific record. It is separate from, and must not be confused with, the IndexedDB database version number above.

### 3. Object Store Name and Configuration

The `datasets` object store uses `keyPath: 'key'` so each dataset record is addressed by its unique dataset key. `autoIncrement` is not set (defaults to false).

```javascript
db.createObjectStore('datasets', { keyPath: 'key' });
```

No secondary indexes are defined on this object store.

### 4. `onupgradeneeded` Behavior

When the database is opened with version `2` and an upgrade is needed, the handler must drop the existing `datasets` store (if present) and recreate it:

```javascript
req.onupgradeneeded = (e) => {
  const db = e.target.result;
  if (db.objectStoreNames.contains('datasets')) {
    db.deleteObjectStore('datasets');
  }
  db.createObjectStore('datasets', { keyPath: 'key' });
};
```

This destructive upgrade pattern means any existing dataset records are cleared when the schema version changes. Applications that add new datasets to this store must be aware of this behavior and re-import data after an upgrade if necessary.

### 5. Dataset Key

The key `asset_reports` is reserved for the Asset Report inventory workbook dataset. No other dataset should use this key.

```
asset_reports
```

### 6. Top-Level Record Shape

```javascript
{
  key: "asset_reports",
  version: 1,
  source: {},
  data: {},
  meta: {}
}
```

### 7. `source` Object

The `source` object describes the origin of the imported workbook.

```javascript
source: {
  type: "xlsx",
  filename: file?.name ?? null,
  importedAt: new Date().toISOString()
}
```

#### Valid `source.type` Values

| Value    | When to use |
|----------|-------------|
| `"xlsx"` | Workbook data imported from the Asset Reports Excel workflow |

Use `"xlsx"` as the shared format label for the workbook import flow even when the browser-side parser can open older Excel workbook variants.

### 8. `data` Object

```javascript
data: {
  ok: true,
  sheetName: "products",
  headers: [...],
  detailRows: [...],
  assetCounts: [...],
  renewalCounts: [...],
  uploadedAt: new Date().toISOString()
}
```

The `asset_reports` dataset stores the canonical imported inventory plus parser-derived summaries.

Lifecycle-enriched fields are intentionally not stored in this dataset. Consumers that need lifecycle dates must join the canonical `detailRows` or `assetCounts` with the shared `hardware_lifecycle` dataset at read time.

### 9. Required Logical Headers

The workbook must provide these five logical columns:

```javascript
[
  "Serial Number",
  "Product Model",
  "Description",
  "Unit Expiration Date",
  "Registration Date"
]
```

The importer matches these headers using a normalized key comparison that is:

- case-insensitive
- whitespace-insensitive
- punctuation-insensitive

For example, `Serial Number`, `serial-number`, and `serial_number` all normalize to the same logical header. Semantic synonyms are not part of this contract.

### 10. Canonical Detail Row Shape

Each row in `data.detailRows` must conform to this normalized shape:

```javascript
{
  serialNumber: "FGT1K0000000001",
  productModel: "FortiGate 100F",
  description: "FortiGate 100F Hardware",
  unitExpirationDate: "2026-06-30",
  quarter: "Q2 2026",
  registrationDate: "2024-07-15"
}
```

#### Field Rules

| Field | Type | Rules |
|-------|------|-------|
| `serialNumber` | string | Required. Trimmed, normalized text from the workbook row. |
| `productModel` | string | Required. Trimmed, normalized text used for cross-tool product matching. |
| `description` | string | Required. Trimmed, normalized text. |
| `unitExpirationDate` | string | Required. Stored as a date-only ISO string in `YYYY-MM-DD` form. |
| `quarter` | string | Required. Derived from `unitExpirationDate` as `Q1`-`Q4` plus four-digit year. |
| `registrationDate` | string | Required. Stored as a date-only ISO string in `YYYY-MM-DD` form. |

### 11. Summary Row Shapes

`data.assetCounts` groups `detailRows` by `productModel`:

```javascript
{
  label: "FortiGate 100F",
  count: 12
}
```

`data.renewalCounts` groups `detailRows` by derived `quarter`:

```javascript
{
  label: "Q2 2026",
  count: 8
}
```

These summary arrays are derived views of the canonical detail rows. They must not contain lifecycle-enriched fields in the shared `asset_reports` dataset.

### 12. Workbook Import Rules

- The imported file must be a readable Excel workbook.
- Prefer the sheet named `"products"` using a case-insensitive match.
- If no `"products"` sheet exists, fall back to the first worksheet in the workbook.
- Convert the selected sheet to a raw row matrix and scan from top to bottom to find the header row.
- The header row is the first row containing all five required logical headers after normalization.
- Ignore completely empty rows before and after the header row.
- For each non-empty row after the header row, map the five required columns into the canonical detail row shape.
- Collapse internal whitespace and trim leading and trailing whitespace for all text fields.
- A row missing any required field after normalization must be skipped rather than partially imported.
- If no valid rows remain after the header row, the import must fail with a clear validation error and must not overwrite the existing `asset_reports` dataset.

### 13. Date Parsing and Storage Rules

The workbook importer may accept all of the following input forms for the two date columns:

- native JavaScript `Date` values
- Excel serial date numbers
- ISO date strings in `YYYY-MM-DD` format
- U.S. date strings in `MM/DD/YY` or `MM/DD/YYYY` format
- other date strings that the runtime can parse reliably

Regardless of the original cell representation, stored shared rows must normalize both date fields to date-only ISO strings in `YYYY-MM-DD` form.

The `quarter` field must be derived from the normalized `unitExpirationDate` using UTC month boundaries:

- January through March -> `Q1`
- April through June -> `Q2`
- July through September -> `Q3`
- October through December -> `Q4`

### 14. Sorting Rules

`data.detailRows` must be sorted using this order:

1. `unitExpirationDate` ascending
2. `productModel` ascending, case-insensitive
3. `serialNumber` ascending, case-insensitive

`data.assetCounts` must be sorted by:

1. `count` descending
2. `label` ascending, case-insensitive

`data.renewalCounts` must be sorted chronologically by quarter label.

### 15. `meta` Object

```javascript
meta: {
  rowCount: detailRows.length,
  headerCount: headers.length,
  skippedRows: skippedRows,
  modelCount: assetCounts.length,
  renewalQuarterCount: renewalCounts.length,
  datasetName: "Asset Report Inventory"
}
```

`datasetName` should remain stable so other tools can present a consistent label for the shared dataset.

### 16. Complete Record Example

```javascript
const assetReportsDataset = {
  key: "asset_reports",
  version: 1,
  source: {
    type: "xlsx",
    filename: "customer-assets.xlsx",
    importedAt: new Date().toISOString()
  },
  data: {
    ok: true,
    sheetName: "products",
    headers: [
      "Serial Number",
      "Product Model",
      "Description",
      "Unit Expiration Date",
      "Registration Date"
    ],
    detailRows: [
      {
        serialNumber: "FGT1K0000000001",
        productModel: "FortiGate 100F",
        description: "FortiGate 100F Hardware",
        unitExpirationDate: "2026-06-30",
        quarter: "Q2 2026",
        registrationDate: "2024-07-15"
      }
    ],
    assetCounts: [
      {
        label: "FortiGate 100F",
        count: 1
      }
    ],
    renewalCounts: [
      {
        label: "Q2 2026",
        count: 1
      }
    ],
    uploadedAt: new Date().toISOString()
  },
  meta: {
    rowCount: 1,
    headerCount: 5,
    skippedRows: 0,
    modelCount: 1,
    renewalQuarterCount: 1,
    datasetName: "Asset Report Inventory"
  }
};
```

### 17. Writing the Record

Use a `readwrite` transaction on the `datasets` object store. Use `put()` (not `add()`) so that reimporting replaces the existing record without affecting other dataset keys.

```javascript
async function saveAssetReportsIDB(record) {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readwrite');
    tx.objectStore('datasets').put(record);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
```

### 18. Reading the Record

Use a `readonly` transaction to retrieve the asset report record by its key:

```javascript
async function getAssetReportsIDB() {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readonly');
    const req = tx.objectStore('datasets').get('asset_reports');
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}
```

Returns the full dataset record, or `null` if no asset report workbook has been imported yet.

### 19. Deleting the Record

Use a `readwrite` transaction and call `delete()` with the dataset key. This removes only the `asset_reports` record and does not affect other dataset records.

```javascript
async function deleteAssetReportsIDB() {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readwrite');
    tx.objectStore('datasets').delete('asset_reports');
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
```

### 20. Compatibility Requirements

- Consumers that need lifecycle context must join `asset_reports` with `hardware_lifecycle` rather than expecting lifecycle fields inside `asset_reports`.
- Asset-report-to-lifecycle joins should normalize product labels by trimming, collapsing internal whitespace to single spaces, and comparing case-insensitively.
- The shared `hardware_lifecycle` dataset remains the source of truth for `End of Order`, `Last Service Extension`, and `End of Support` dates.
- Consumers should treat `detailRows` as the canonical inventory payload and `assetCounts` / `renewalCounts` as derived convenience views.

### 21. Versioning and Schema Migration

The top-level `version` field inside the record (currently `1`) represents the schema version of the `asset_reports` record shape, not the IndexedDB database version.

If the record schema changes in a future revision, increment this field. Consumers reading an `asset_reports` record should check this field and handle or reject unknown versions gracefully.

The IndexedDB database version (currently `2`) must be incremented any time a structural change to the database is required (for example, adding a new object store or adding an index). Note that the current `onupgradeneeded` handler is destructive — it drops and recreates the `datasets` store, clearing all records. Any increment to the database version will require all datasets to be re-imported.
