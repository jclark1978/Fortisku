# toolbox-shared IndexedDB Overview

## Purpose

This document describes the shared browser-side IndexedDB database used by the Toolbox application suite. It defines the database-level configuration, object store structure, and the conventions that all dataset modules must follow.

This document does not define any individual dataset. Each dataset has its own specification document that follows the naming convention `toolbox-shared-[dataset-name]-dataset-spec.md`.

## What This Document Covers

- The shared database name and version
- The `onupgradeneeded` initialization behavior
- The shared object store name and configuration
- The dataset record shape convention
- Dataset key reservation rules
- How to open the database
- How datasets co-exist without colliding
- How to add a new dataset

## What This Document Does Not Cover

- The shape, headers, validation rules, or import behavior of any specific dataset
- Application-level business logic

---

## Database Configuration

### Name
```
toolbox_shared
```

### Version
```
2
```

The database must be opened with version `2`. If an older version is detected, the `onupgradeneeded` handler runs to upgrade the schema.

---

## Object Store

### Name
```
datasets
```

### Configuration

```javascript
db.createObjectStore('datasets', { keyPath: 'key' });
```

- `keyPath` is `'key'`, so each record is addressed by its unique string key
- `autoIncrement` is not set (defaults to `false`)
- No secondary indexes are defined on this object store

All datasets — regardless of type or origin — are stored as records in this single object store, distinguished only by their `key` value.

---

## Opening the Database

All applications that read or write shared datasets must open the database using the same name, version, and `onupgradeneeded` handler. Using a different version number or a different upgrade handler will produce incompatible databases.

```javascript
let _sharedDb = null;

function openSharedDB() {
  if (_sharedDb) return Promise.resolve(_sharedDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('toolbox_shared', 2);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (db.objectStoreNames.contains('datasets')) {
        db.deleteObjectStore('datasets');
      }
      db.createObjectStore('datasets', { keyPath: 'key' });
    };
    req.onsuccess = (e) => { _sharedDb = e.target.result; resolve(_sharedDb); };
    req.onerror = (e) => reject(e.target.error);
  });
}
```

Cache the `db` reference after the first open rather than reopening it on every operation.

---

## `onupgradeneeded` Behavior

The upgrade handler drops the `datasets` object store if it exists and recreates it. This is a **destructive operation** — all existing dataset records are cleared whenever the database version is incremented.

**Implication:** Any application or dataset module that increments the database version must account for the fact that all previously stored datasets will be erased. Users will need to re-import their data after an upgrade.

If a future schema change requires preserving existing records, the upgrade handler must be redesigned to migrate data rather than drop the store. Any such change requires a new version of this overview document.

---

## Dataset Record Shape Convention

Every record stored in the `datasets` object store must conform to the following top-level shape:

```javascript
{
  key: "dataset-key",   // Unique string key; must match the object store keyPath
  version: 1,           // Schema version for this specific record, not the DB version
  source: { ... },      // Describes the origin of the data (import type, filename, timestamp)
  data: { ... },        // The actual dataset content
  meta: { ... }         // Summary metadata about the dataset
}
```

### Field Descriptions

| Field     | Type   | Description |
|-----------|--------|-------------|
| `key`     | string | Unique identifier for this dataset. Must match a reserved key defined in the dataset's spec. |
| `version` | number | Schema version of this record's shape. Starts at `1`. Increment when the record structure changes. Independent of the IndexedDB database version. |
| `source`  | object | Describes how the data was imported. Must include at minimum: `importedAt`. Additional required fields are defined by the dataset specification. |
| `data`    | object | Contains the dataset content. Structure is defined by the individual dataset specification. |
| `meta`    | object | Contains summary counts and display metadata. Structure is defined by the individual dataset specification. |

### `source` Object Minimum Shape

```javascript
source: {
  importedAt: string    // ISO 8601 timestamp
}
```

Dataset specifications may require additional source fields such as:

- `type` / `filename` for workbook-style imports
- `app` / `format` / `label` / `effectiveDate` for feed-style imports

Valid source fields and values are defined by each dataset's specification document.

---

## Dataset Key Reservation

Each dataset is identified by a unique string key stored in the `key` field. Keys are reserved on a per-dataset basis and must not be reused across datasets.

### Currently Reserved Keys

| Key       | Dataset                        | Specification Document                        |
|-----------|--------------------------------|-----------------------------------------------|
| `pricing` | Fortinet Official Price List   | `toolbox-shared-pricing-dataset-spec.md`      |
| `hardware_lifecycle` | Fortinet Hardware Lifecycle RSS | `toolbox-shared-hardware-lifecycle-dataset-spec.md` |
| `asset_reports` | Asset Report Inventory Workbook | `toolbox-shared-asset-reports-dataset-spec.md` |

### Rules

- A key, once reserved for a dataset, must not be reused or reassigned to a different dataset.
- New datasets must register their key in this table before use.
- Keys are case-sensitive lowercase strings. Use hyphens to separate words if needed (e.g. `my-dataset`).

---

## Reading a Dataset

To read any dataset, open the database and perform a `readonly` transaction on the `datasets` store, using `get()` with the dataset's reserved key:

```javascript
async function getDataset(key) {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readonly');
    const req = tx.objectStore('datasets').get(key);
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}
```

Returns the full dataset record, or `null` if no data has been stored under that key.

---

## Writing a Dataset

Use `put()` (not `add()`) with a `readwrite` transaction. `put()` inserts a new record or replaces an existing one, and only affects the record with the matching key. Other dataset records are not modified.

```javascript
async function saveDataset(record) {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readwrite');
    tx.objectStore('datasets').put(record);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
```

A dataset write must never delete, overwrite, or modify records belonging to other datasets.

---

## Deleting a Dataset

Use `delete()` with the dataset's reserved key. Only the targeted record is removed.

```javascript
async function deleteDataset(key) {
  const db = await openSharedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readwrite');
    tx.objectStore('datasets').delete(key);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
```

---

## Dataset Co-existence Rules

Multiple datasets can be stored simultaneously in the `datasets` object store. The following rules ensure they do not interfere with each other:

1. Each dataset must use a unique key registered in this document's reserved key table.
2. A dataset's write operation must use `put()` with its own key only. It must not call `clear()`, `delete()` with another key, or perform any bulk operation.
3. A dataset's validation and import logic must be fully self-contained and must not depend on or modify other datasets.
4. A dataset's specification document is the sole authority on that dataset's record shape, validation rules, and import behavior.

---

## Adding a New Dataset

To add a new dataset to the shared store:

1. Choose a unique key not already listed in the reserved key table above.
2. Create a new specification document following the naming convention: `toolbox-shared-[dataset-name]-dataset-spec.md`.
3. The specification must define at minimum: the dataset key, the full record shape, `source.type` valid values, validation rules, import behavior, and read/write patterns.
4. Update the reserved key table in this document to register the new key.
5. Implement read, write, and delete operations using the patterns in this document, scoped to the new key only.

---

## Versioning

### Database Version (`2`)
The IndexedDB database version is incremented only when a structural change to the database is required — for example, adding a new object store or changing the `onupgradeneeded` logic. Incrementing this value triggers the upgrade handler, which in the current implementation destroys and recreates all data. This is a breaking change and must be coordinated across all applications that share this database.

### Record Version (`version` field)
Each dataset record contains its own `version` field. This tracks the schema version of that record's shape and is independent of the database version. Increment a record's `version` when its `data` or `meta` structure changes in a backward-incompatible way. Consumers should check this field and handle or reject unknown versions gracefully.

---

## Registered Dataset Specifications

| Document                                      | Dataset Key | Description                        |
|-----------------------------------------------|-------------|------------------------------------|
| `toolbox-shared-pricing-dataset-spec.md`      | `pricing`   | Fortinet Official Price List data  |
| `toolbox-shared-hardware-lifecycle-dataset-spec.md` | `hardware_lifecycle` | Fortinet Hardware LifeCycle RSS milestone data |
| `toolbox-shared-asset-reports-dataset-spec.md` | `asset_reports` | Asset Report inventory workbook data |
