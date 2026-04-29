# FortiSKU Shared Data Migration Prompt

Use this prompt with the coding agent working in the FortiSKU repository.

This repository already has:
- SKU Finder workbook ingestion
- BOM Builder wrapping FabricBOM
- Hardware Lifecycle data from RSS
- Software Lifecycle data from RSS

The goal is to make FortiSKU the clean writer of a shared local browser dataset contract that FabricBOM can consume without knowing FortiSKU's internal storage details.

## Goal

Refactor FortiSKU so that imported tool data is written into a shared browser data contract instead of being trapped in feature-specific storage shapes.

The end state should be:
- SKU Finder continues to import the Excel pricelist workbook
- Hardware Lifecycle continues to import from RSS
- Software Lifecycle continues to import from RSS
- all three datasets are also written into a shared IndexedDB schema
- BOM Builder and embedded FabricBOM can rely on that shared schema instead of FortiSKU-specific keys
- the Excel workbook pipeline is the only pricing source of truth for the shared `pricing` dataset

## Existing FortiSKU Behavior

FortiSKU currently stores SKU Finder data using `idb-keyval` with keys such as:
- `fortisku-finder:rows:v4`
- `fortisku-finder:index:v4`
- `fortisku-finder:meta:v4`

That is fine for internal feature state, but it is not a stable interoperability layer for another application.

## New Shared Storage Contract

Implement this shared IndexedDB contract:

- DB name: `toolbox_shared`
- schema version: `1`
- object store: `datasets`

Keys:
- `pricing`
- `hardware_lifecycle`
- `software_lifecycle`

### Dataset Envelope

Store each dataset using this envelope:

```js
{
  key: "pricing",
  version: 1,
  source: {
    app: "FortiSKU",
    format: "xlsx" | "rss",
    label: string | null,
    importedAt: "ISO-8601 timestamp",
    effectiveDate: string | null
  },
  data: {
    rows: []
  },
  meta: {
    rowCount: number,
    schema: "toolbox_shared.pricing.v1"
  }
}
```

### Shared Pricing Row Shape

Normalize pricing rows to:

```js
{
  sku: string,
  description1: string,
  description2: string,
  price: number | null,
  priceDisplay: string,
  category: string,
  comments: string
}
```

### Shared Lifecycle Row Shape

Use a stable normalized lifecycle row shape for both hardware and software datasets:

```js
{
  product: string,
  release: string,
  milestone: string,
  date: string,
  details: string,
  sourceUrl: string
}
```

If current lifecycle fields differ, map them into the closest equivalent stable shape and keep feature-specific derived fields internal to FortiSKU as needed.

## Main Migration Tasks

### 1. Add a shared storage adapter

Create a small shared module in FortiSKU that owns access to:
- DB `toolbox_shared`
- store `datasets`

Expose helpers like:
- `getSharedDataset(key)`
- `saveSharedDataset(key, payload)`
- `deleteSharedDataset(key)`
- `hasSharedDataset(key)`

This module should be the only place that knows the raw IndexedDB details of the shared contract.

### 2. Keep FortiSKU internal feature storage if useful

Do not force every FortiSKU feature to stop using its current internal storage if that would create unnecessary churn.

Instead:
- keep existing feature storage where it helps app performance and UX
- add synchronized writes to the shared `toolbox_shared` contract

The shared contract is the interoperability boundary.

### 3. Update pricing import flow to publish shared data

FortiSKU already imports an Excel workbook and normalizes rows. Keep that logic, but after import also write a shared `pricing` dataset.

The shared `pricing` dataset should be sourced from the workbook import flow only.

Do not add or preserve a parallel CSV-based pricing ingestion path for cross-tool interoperability.

Current import behavior that must be preserved:
- default sheet name `DataSet`
- dynamic header-row detection
- support for header synonyms
- required SKU and primary description
- numeric price parsing
- original price display preservation
- row sanitization
- empty-row skipping
- sort by SKU

Current header mapping logic to preserve:

- `sku`: `sku`, `product_sku`, `part`, `partnumber`
- `description`: `description`, `description#1`, `description1`, `desc`, `itemdescription`, `productdescription`
- `description2`: `description#2`, `description2`, `desc2`, `itemdescription2`, `productdescription2`, `secondarydescription`
- `price`: `price`, `listprice`, `unitprice`, `msrp`, `usdprice`
- `category`: `category`, `productcategory`, `family`, `productfamily`, `familyname`, `productline`, `bundle`, `solution`, `segment`, `portfolio`
- `comments`: `comments`, `comment`, `notes`, `note`

Map the existing normalized row fields into the shared row shape:
- `description` -> `description1`
- `price_display` -> `priceDisplay`

Use workbook metadata when available:
- `source.app = "FortiSKU"`
- `source.format = "xlsx"`
- `source.label = cover sheet info when present`
- `source.importedAt = import timestamp`

This workbook-derived shared dataset is the canonical pricing source for:
- SKU Finder dependent workflows
- BOM Builder interoperability
- any compatible external tool that reads the shared `pricing` dataset

### 4. Publish lifecycle data into the shared contract

When hardware lifecycle data is fetched and normalized, also save:
- key `hardware_lifecycle`

When software lifecycle data is fetched and normalized, also save:
- key `software_lifecycle`

The lifecycle pages can keep their current internal caches and search indexes, but they must publish normalized shared rows as well.

### 5. Add a unified data-source page or section

Create a user-facing page or shared configuration surface for managing imported datasets.

The name can be:
- `Configuration`
- `Data Sources`
- `Tool Data`

Preferred behavior:
- show pricing dataset status
- show hardware lifecycle dataset status
- show software lifecycle dataset status
- show last imported time
- show source label when available
- offer refresh / clear actions per dataset

Important:
- this page is the user workflow improvement
- the shared schema is the architectural requirement

If building a whole new page is too disruptive in one pass, create the shared storage first and leave a clean follow-up seam for the UI consolidation.

### 6. Prepare BOM Builder integration

FortiSKU's BOM Builder wrapper should be able to rely on the shared `pricing` dataset as the source of truth for cross-app interoperability.

Do not hard-code FabricBOM-specific DB names inside FortiSKU.

If there is existing copy that says BOM Builder uses a shared pricing database, update the implementation so that statement becomes true through `toolbox_shared`.

### 7. Preserve backward compatibility where reasonable

If current FortiSKU pages expect internal feature-specific storage, keep that behavior unless it creates major duplication or confusion.

The recommended model is:
- existing feature storage remains for local UX
- shared storage is written alongside it

If you add a one-time migration or sync helper, keep it small and reversible.

## Suggested Module Boundaries

Prefer a small set of shared modules, for example:
- one shared storage adapter
- one pricing dataset mapper
- one lifecycle dataset mapper
- optional shared dataset status helper

Use the repo's existing folder layout rather than inventing unnecessary new top-level structures.

## Acceptance Criteria

The migration is complete when all of the following are true:

1. SKU Finder workbook import still works.
2. Workbook import writes normalized pricing rows into `toolbox_shared` / `datasets` / `pricing`.
3. Hardware Lifecycle fetch writes normalized rows into `toolbox_shared` / `datasets` / `hardware_lifecycle`.
4. Software Lifecycle fetch writes normalized rows into `toolbox_shared` / `datasets` / `software_lifecycle`.
5. The shared `pricing` dataset is sourced from the Excel workbook import flow only.
6. Existing FortiSKU feature behavior remains functional.
7. BOM Builder now has a clean shared-data seam for pricing interoperability.
8. Raw shared IndexedDB details are isolated in one adapter rather than repeated across features.

## Non-Goals

- Do not rewrite SKU Finder search unless needed
- Do not rewrite lifecycle business logic unless needed
- Do not force FabricBOM-specific code into unrelated FortiSKU modules
- Do not over-abstract beyond the shared data contract

## Deliverables

When finished, report:
- which files were changed
- where the shared storage adapter lives
- where pricing dataset publishing happens
- how the workbook import flow is established as the only shared pricing source of truth
- where lifecycle dataset publishing happens
- whether a new Configuration/Data Sources page was added
- any migration or backward-compatibility caveats
