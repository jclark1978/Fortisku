# FabricBOM Shared Data Migration Prompt

Use this prompt with the coding agent working in the upstream `msalty/FabricBOM` repository.

Repository reference:
- GitHub: https://github.com/msalty/FabricBOM
- Current upstream structure at the time of writing:
  - `index.html`
  - `products/`
  - `icons/`
  - `prompts/`
  - `sw.js`
  - `manifest.json`

The exact file layout in your checkout may differ slightly. Follow the repository's real structure if it differs from this document, but preserve the architecture and storage contract described here.

## Why This Migration Exists

FabricBOM is being prepared to interoperate cleanly with another browser-only tool in the same workflow family.

The requirement is not to depend on that other tool's codebase or folder structure. The requirement is to move FabricBOM to a shared local browser data contract so that:
- FabricBOM can still run completely standalone
- FabricBOM can import pricing data by itself
- FabricBOM can also read pricing data written by another compatible tool
- future shared datasets can be added without another storage redesign

Treat this as an interoperability and storage-normalization migration.

## Goal

Migrate FabricBOM away from its app-specific pricing database and onto a shared local browser data contract.

The end state should be:
- FabricBOM can still run standalone
- FabricBOM can import pricing from the Excel workbook source only
- FabricBOM writes imported pricing into a normalized shared IndexedDB schema
- FabricBOM reads pricing for Project BOM and Custom SKU search from that normalized shared schema
- FabricBOM is prepared to consume shared lifecycle datasets later
- FabricBOM no longer hard-codes its business logic to the legacy `fabricbom_pricing` schema or a CSV-specific workflow

## Current Behavior To Replace

FabricBOM currently stores pricing in its own IndexedDB database:
- DB name: `fabricbom_pricing`
- object store: `pricing`
- key: `current`

That shape is too app-specific and makes upstream sync harder between parallel projects.

## New Shared Storage Contract

Implement a shared IndexedDB database contract named:

- DB name: `toolbox_shared`
- schema version: `1`

Use one object store:

- object store: `datasets`

Store records by key:

- `pricing`
- `hardware_lifecycle`
- `software_lifecycle`

For this migration, fully implement `pricing` and add the storage scaffolding for the lifecycle keys even if FabricBOM does not consume lifecycle data yet.

### Dataset Envelope

Each dataset record in `datasets` must use this envelope:

```js
{
  key: "pricing",
  version: 1,
  source: {
    app: "FabricBOM" | "FortiSKU" | string,
    format: "xlsx" | "csv" | "rss" | string,
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

Normalize all pricing rows to this shape before saving:

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

Notes:
- `sku` is the canonical lookup key
- `price` should be numeric when it can be parsed
- `priceDisplay` should preserve the original human-readable value when present
- missing values should become empty strings, except `price`, which may be `null`

## Migration Requirements

### 1. Create a shared storage adapter

Add a small shared storage module for FabricBOM that:
- opens `toolbox_shared`
- creates the `datasets` object store if needed
- exposes helpers such as:
  - `getDataset(key)`
  - `saveDataset(key, payload)`
  - `deleteDataset(key)`
  - `hasDataset(key)`

Keep this adapter isolated so future upstream pulls only need to preserve a narrow integration seam.

### 2. Replace direct reads of `fabricbom_pricing`

Find every place FabricBOM currently reads or writes the legacy pricing database and refactor it to use the shared adapter.

At minimum, this currently affects:
- `index.html`
- `products/custom-sku-bomgen.html`
- `products/custom-sku-bomgen-mobile.html`

Use the repo's current real paths if they differ.

### 3. Keep standalone FabricBOM usable

FabricBOM must still allow a user to upload pricing directly inside FabricBOM when it runs by itself.

After this migration, standalone import must support:
- Fortinet pricing Excel workbook formats such as `.xlsx`

The result of either import path must be normalized and saved into:
- DB: `toolbox_shared`
- store: `datasets`
- key: `pricing`

Do not keep `fabricbom_pricing` as the primary source of truth.

### 4. Replace CSV import with Excel workbook import and normalize the result

FabricBOM currently ingests a Fortinet pricing CSV. Remove that as the primary import workflow and replace it with Fortinet Excel workbook import.

If the repo does not already include an Excel parser, add one in the least disruptive way possible.

Preferred implementation:
- use a vendored browser-safe workbook parser such as SheetJS `xlsx`
- do not introduce a server dependency
- keep the app browser-only

You may add a vendored dependency if needed, but keep it isolated and document where it is used.

#### Required shared output shape

Normalize all imported pricing rows to:

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

#### Excel workbook normalization rules

When parsing Excel workbooks:
- default target sheet name should be `DataSet` if present
- if `DataSet` is not present, fall back to the first sheet
- detect the header row dynamically instead of assuming it is always the first row
- require both a SKU column and a primary description column
- accept header synonyms
- skip empty rows
- trim and sanitize string values
- parse numeric price when possible
- preserve the original price display string
- sort normalized rows by `sku`

Header mapping to support:

- `sku`: `sku`, `product_sku`, `part`, `partnumber`
- `description1`: `description`, `description#1`, `description1`, `desc`, `itemdescription`, `productdescription`
- `description2`: `description#2`, `description2`, `desc2`, `itemdescription2`, `productdescription2`, `secondarydescription`
- `price`: `price`, `listprice`, `unitprice`, `msrp`, `usdprice`
- `category`: `category`, `productcategory`, `family`, `productfamily`, `familyname`, `productline`, `bundle`, `solution`, `segment`, `portfolio`
- `comments`: `comments`, `comment`, `notes`, `note`

Workbook metadata rules:
- if a workbook contains a `Cover Sheet`, `Cover`, or `Coversheet` tab, read cell `C7` when available and use that value as the human-readable source label
- store that label in `source.label`
- set `source.format = "xlsx"`
- set `source.importedAt` to the import timestamp

If the workbook cannot be parsed into valid pricing rows, show a clear user-facing error rather than silently saving partial garbage.

#### UI and workflow change

Update the pricing import UI and any related copy so it no longer suggests CSV upload.

The pricing workflow should now be workbook-based only.

Any legacy CSV-specific helpers should be removed unless you intentionally keep a very small backward-compatibility fallback during migration. If you keep such a fallback temporarily, it must not remain the documented or primary workflow.

### 5. Update Project BOM pricing lookup

When rendering Project BOM totals:
- read the `pricing` dataset from `toolbox_shared`
- build a lookup map from normalized `sku` to normalized `price`
- continue matching against the BOM row `sku`

Do not rely on uppercase CSV column names such as `row["SKU"]` or `row["Price"]` after migration.

### 6. Update Custom SKU search

Custom SKU entry currently searches against the legacy pricing row shape.

Refactor it to search the normalized shared rows:
- `sku`
- `description1`
- `description2`

It should continue supporting:
- partial SKU search
- description search
- exact SKU lookup
- exact description lookup

### 7. Preserve future interoperability

Even if FabricBOM does not use lifecycle data yet, add a small placeholder note or utility constants for:
- `hardware_lifecycle`
- `software_lifecycle`

This is to establish the shared contract early so later cross-tool work does not require a second schema migration.

## Suggested Implementation Shape

The cleanest approach is:

1. Add one shared storage utility module
2. Add one pricing normalization utility module
3. Add one import adapter layer for XLSX workbook ingestion
4. Refactor existing pricing consumers to depend on those utilities
5. Leave product BOM generation logic alone

Avoid scattering database details across:
- `index.html`
- custom SKU pages
- unrelated product pages

## Acceptance Criteria

The migration is complete when all of the following are true:

1. Standalone FabricBOM can import a pricing Excel workbook and use it in Project BOM.
2. Pricing import UI and messaging are workbook-based rather than CSV-based.
3. Imported pricing is stored in `toolbox_shared` / `datasets` / `pricing`.
4. Project BOM totals are computed from normalized rows with `sku` and `price`.
5. Custom SKU search works against normalized rows.
6. No primary pricing workflow depends on `fabricbom_pricing`.
7. No primary pricing workflow depends on CSV import.
8. FabricBOM is ready to coexist with another app writing the same shared `pricing` dataset.
9. The code isolates storage access behind a small adapter rather than repeating raw IndexedDB logic.

## Non-Goals

- Do not redesign FabricBOM's product generators
- Do not change the BOM `postMessage` contract unless necessary
- Do not bind this migration to another tool's folder layout

## Deliverables

When finished, report:
- which files were changed
- where the shared storage adapter lives
- whether CSV import code was fully removed or retained only as a temporary migration fallback
- where XLSX import lives after refactor
- where pricing normalization lives
- whether legacy `fabricbom_pricing` reads were fully removed or kept only as an optional migration fallback
- any follow-up risks or compatibility notes
