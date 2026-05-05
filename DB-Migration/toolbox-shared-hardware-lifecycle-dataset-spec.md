## Scope

This document defines the dataset-specific IndexedDB specification for storing Fortinet Hardware LifeCycle RSS data in the shared browser-side IndexedDB format used by the Toolbox application suite.

The shared IndexedDB database and object store are common across all shared datasets. This document defines only the Hardware LifeCycle dataset module that lives inside that shared storage container.

Other datasets may also be stored in the same shared IndexedDB database, but each dataset must have its own separate specification defining its dataset key, record shape, validation rules, import behavior, metadata, and compatibility requirements.

The Hardware LifeCycle dataset is stored under the unique dataset key `hardware_lifecycle`. This key is reserved for the Fortinet Hardware LifeCycle dataset and must not be reused by any other dataset.

Importing or replacing the Hardware LifeCycle dataset must only update the record with key `hardware_lifecycle`. It must not delete, overwrite, migrate, or modify other records in the `datasets` object store.

This document defines:

- The shared IndexedDB database name and version
- The shared object store name and configuration
- The `onupgradeneeded` initialization behavior
- The Hardware LifeCycle dataset key
- The Hardware LifeCycle record shape
- The RSS-derived shared row shape
- Valid source metadata fields
- RSS parsing and expansion rules
- Dataset metadata requirements
- Versioning expectations
- How to read the dataset from other applications
- Compatibility requirements for tools such as Asset Reports

This document does not define schemas for unrelated datasets. Future datasets should be documented in separate dataset-specific specification documents that follow the same modular pattern.

## IndexedDB Hardware LifeCycle Dataset Specification

### 1. IndexedDB Name
```
toolbox_shared
```

### 2. IndexedDB Version

Open the database with version `2`:

```javascript
const req = indexedDB.open('toolbox_shared', 2);
```

The top-level `version` field inside each dataset record (for example `{ key: "hardware_lifecycle", version: 1, ... }`) is the schema version for that specific record. It is separate from, and must not be confused with, the IndexedDB database version number above.

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

The key `hardware_lifecycle` is reserved for the Fortinet Hardware LifeCycle dataset. No other dataset should use this key.

```
hardware_lifecycle
```

### 6. Top-Level Record Shape

```javascript
{
  key: "hardware_lifecycle",
  version: 1,
  source: {},
  data: {},
  meta: {}
}
```

### 7. `source` Object

The `source` object describes the origin of the imported RSS data.

```javascript
source: {
  app: "FortiSKU",
  format: "rss",
  label: meta.feedSourceTitle ?? meta.feedTitle ?? null,
  importedAt: meta.updatedAt,
  effectiveDate: meta.feedUpdatedAt ?? null
}
```

#### Valid `source.format` Values

| Value   | When to use |
|---------|-------------|
| `"rss"` | Data was imported from the Fortinet Hardware RSS feed XML |

No other values are valid for this dataset.

### 8. `data` Object

```javascript
data: {
  rows: [...]
}
```

The shared `hardware_lifecycle` dataset stores milestone rows, not the internal FortiSKU product-level cache rows.

### 9. Shared Row Shape

Each row in `data.rows` must conform to this normalized shape:

```javascript
{
  product: "FortiGate 100F",
  release: "",
  milestone: "End of Order",
  date: "2026-06-30",
  details: "FortiGate",
  sourceUrl: ""
}
```

#### Field Rules

| Field | Type | Rules |
|-------|------|-------|
| `product` | string | Required. Product label from the RSS item `<title>`. |
| `release` | string | Always `""` for hardware lifecycle rows. Reserved for compatibility with the shared lifecycle shape used by software lifecycle data. |
| `milestone` | string | One of `"End of Order"`, `"Last Service Extension"`, `"End of Support"`, or `""` when no milestone dates are available. |
| `date` | string | Milestone date string. For interoperability, this should be a date-only ISO string such as `"2026-06-30"` when present. Use `""` when the milestone is absent. |
| `details` | string | Category text extracted from the RSS item description. |
| `sourceUrl` | string | Currently stored as `""`. Reserved for future feed/source deep links. |

### 10. Expansion Rules

FortiSKU's internal hardware lifecycle parser first produces one product-level row:

```javascript
{
  id: "lcr-row-1",
  product: "FortiGate 100F",
  category: "FortiGate",
  endOfOrderDate: "2026-06-30",
  lastServiceExtensionDate: "2030-06-30",
  endOfSupportDate: "2031-06-30"
}
```

The shared dataset then expands that product row into one row per non-empty milestone:

```javascript
[
  {
    product: "FortiGate 100F",
    release: "",
    milestone: "End of Order",
    date: "2026-06-30",
    details: "FortiGate",
    sourceUrl: ""
  },
  {
    product: "FortiGate 100F",
    release: "",
    milestone: "Last Service Extension",
    date: "2030-06-30",
    details: "FortiGate",
    sourceUrl: ""
  },
  {
    product: "FortiGate 100F",
    release: "",
    milestone: "End of Support",
    date: "2031-06-30",
    details: "FortiGate",
    sourceUrl: ""
  }
]
```

If a product has no milestone dates at all, emit exactly one placeholder row so the product still exists in the shared dataset:

```javascript
{
  product: "FortiExample 1A",
  release: "",
  milestone: "",
  date: "",
  details: "Example Category",
  sourceUrl: ""
}
```

### 11. RSS Import Rules

- The imported file must contain a valid RSS XML `<channel>`.
- The channel `<title>` becomes `meta.feedTitle` in FortiSKU's internal cache and is used as the preferred shared `source.label`.
- The channel `<lastBuildDate>` becomes `source.effectiveDate`.
- Each `<item>` must use its `<title>` as the shared `product` label.
- The item `<description>` must be normalized from HTML into plain text before field extraction.
- The labeled description fields `Category`, `End of Order`, `Last Service Extension`, and `End of Support` are extracted when present.
- Items without a product title must be skipped.
- Shared dataset writes must expand the product-level rows into milestone rows using the rules above.
- Import failures must not overwrite the existing `hardware_lifecycle` record.

### 12. `meta` Object

```javascript
meta: {
  rowCount: rows.length,
  schema: "toolbox_shared.hardware_lifecycle.v1"
}
```

No other `meta` fields are required by the shared contract.

### 13. Complete Record Example

```javascript
const hardwareLifecycleDataset = {
  key: "hardware_lifecycle",
  version: 1,
  source: {
    app: "FortiSKU",
    format: "rss",
    label: "Fortinet Product Lifecycle RSS",
    importedAt: new Date().toISOString(),
    effectiveDate: "Tue, 05 May 2026 00:00:00 GMT"
  },
  data: {
    rows: [
      {
        product: "FortiGate 100F",
        release: "",
        milestone: "End of Order",
        date: "2026-06-30",
        details: "FortiGate",
        sourceUrl: ""
      },
      {
        product: "FortiGate 100F",
        release: "",
        milestone: "Last Service Extension",
        date: "2030-06-30",
        details: "FortiGate",
        sourceUrl: ""
      },
      {
        product: "FortiGate 100F",
        release: "",
        milestone: "End of Support",
        date: "2031-06-30",
        details: "FortiGate",
        sourceUrl: ""
      }
    ]
  },
  meta: {
    rowCount: 3,
    schema: "toolbox_shared.hardware_lifecycle.v1"
  }
};
```

### 14. Writing the Record

Use a `readwrite` transaction on the `datasets` object store. Use `put()` (not `add()`) so that reimporting replaces the existing record without affecting other dataset keys.

```javascript
async function saveHardwareLifecycleIDB(record) {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readwrite');
    tx.objectStore('datasets').put(record);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
```

### 15. Reading the Record

Use a `readonly` transaction to retrieve the hardware lifecycle record by its key:

```javascript
async function getHardwareLifecycleIDB() {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readonly');
    const req = tx.objectStore('datasets').get('hardware_lifecycle');
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}
```

Returns the full dataset record, or `null` if no hardware lifecycle data has been imported yet.

### 16. Deleting the Record

Use a `readwrite` transaction and call `delete()` with the dataset key. This removes only the `hardware_lifecycle` record and does not affect other dataset records.

```javascript
async function deleteHardwareLifecycleIDB() {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readwrite');
    tx.objectStore('datasets').delete('hardware_lifecycle');
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
```

### 17. Compatibility Requirements

- Consumers that need per-product milestone lookups should group `data.rows` by normalized `product`.
- Asset-report workflows should normalize join keys by trimming, collapsing internal whitespace to single spaces, and comparing case-insensitively.
- Consumers should treat `End of Order`, `Last Service Extension`, and `End of Support` as the canonical hardware milestone labels.
- Consumers that need sortable milestone dates should expect `date` to be a date-only ISO string when present.

### 18. Versioning and Schema Migration

The top-level `version` field inside the record (currently `1`) represents the schema version of the `hardware_lifecycle` record shape, not the IndexedDB database version.

If the record schema changes in a future revision, increment this field. Consumers reading a `hardware_lifecycle` record should check this field and handle or reject unknown versions gracefully.

The IndexedDB database version (currently `2`) must be incremented any time a structural change to the database is required (for example, adding a new object store or adding an index). Note that the current `onupgradeneeded` handler is destructive — it drops and recreates the `datasets` store, clearing all records. Any increment to the database version will require all datasets to be re-imported.
