# FabricBOM Builder Integration Plan

## Goal

Keep BOM Builder as a native-feeling SE Toolbox page while using `FabricBOM` as an upstream-synced embedded workspace.

The current direction is:

- SE Toolbox owns the route, shell, navigation, and theme behavior
- `FabricBOM` owns the embedded BOM workspace and product generators
- the shared workbook-derived dataset remains the pricing source of truth
- local integration patches stay thin and deliberate

## Current State

As of this migration pass:

- the vendored upstream snapshot has been refreshed from the canonical `msalty/FabricBOM` repository
- the latest refresh used `https://github.com/msalty/FabricBOM.git` branch `dev` at commit `e787a56` because a `Development` branch was not present
- the BOM Builder wrapper still embeds the vendored app through `/bom-builder/`
- SE Toolbox navigation can now reach the newer upstream products
- SE Toolbox navigation can reach upstream's Pricing Dataset Search page when shared pricing data exists
- pricing is being standardized onto a shared IndexedDB dataset contract
- the theme bridge has been expanded to cover the newer upstream shell controls
- the embedded FabricBOM pricing flow now uses workbook import (`.xlsx` / `.xls`) instead of the legacy CSV-only path
- the embedded FabricBOM pricing flow now uses local vendored helper assets for offline-safe workbook parsing and shared dataset access

Current local integration points:

- `bom-builder/index.html`
- `src/features/bom-builder/main.js`
- `src/features/bom-builder/catalog.js`
- `src/features/bom-builder/theme-bridge.css`
- `src/shared/data/shared-storage.js`
- `vendor/FortiBOM/`
- `vendor/FortiBOM/docs/`
- `vendor/FortiBOM/forti-icons/`
- `vendor/FortiBOM/products/asku.html`
- `sw.js`

Note:

- the vendored folder path remains `vendor/FortiBOM/` for now to avoid a larger path and cache refactor during the upstream migration
- user-facing naming in SE Toolbox should use `FabricBOM`

## Architecture Decision

Do not import `FabricBOM` wholesale into the SE Toolbox shell.

Do not rewrite the whole tool natively yet either.

The best fit right now is an adapter-style integration:

- SE Toolbox owns the surrounding experience
- `FabricBOM` stays vendored as the upstream BOM engine
- local patches focus on wrapper behavior, theme bridging, and pricing integration

This gives us:

- a realistic path for future upstream refreshes
- a consistent SE Toolbox user experience
- less duplicated logic
- an easier future migration path if selected products become native modules later

## Ownership Split

SE Toolbox-owned:

- route and wrapper page
- shared navigation and shell
- theme synchronization
- embedded-frame control logic
- product catalog mapping for SE Toolbox navigation
- local documentation and migration workflow

FabricBOM-owned initially:

- upstream hub shell and product iframe loader
- per-product generators
- Project BOM semantics
- import/export behavior
- local storage/session behavior

Shared boundary:

- iframe host in `bom-builder/index.html`
- embedded control hooks used by the wrapper:
  - `loadProduct()`
  - `showPBV()`
  - `showSavedProjects()`
- postMessage add-to-BOM flow
- shared dataset IndexedDB access

## Shared Data Contract

The long-term interoperability boundary between SE Toolbox and upstream `FabricBOM` is a shared browser-only IndexedDB contract.

Use:

- DB name: `toolbox_shared`
- DB version: `2`
- object store: `datasets`
- object store keying: `datasets` is created with `{ keyPath: "key" }`

Implementation note:

- all apps that participate in the shared dataset contract must open the database as `indexedDB.open("toolbox_shared", 2)`
- the current `onupgradeneeded` contract is destructive:
  - if `datasets` exists, delete it
  - recreate `datasets` with `{ keyPath: "key" }`
- vendor-side helper code must remain compatible with that exact open/upgrade behavior
- do not assume a keyless object store plus explicit `.put(payload, key)` calls as the primary shape
- when saving shared datasets, prefer writing `{ ...payload, key }` and support `store.keyPath === "key"` safely

Dataset keys:

- `pricing`

Practical rule:

- for this integration, treat `pricing` as the only required shared dataset key unless and until a separate dataset spec formally reserves more keys

### Dataset Envelope

Each dataset record stored in `datasets` should follow the shared top-level shape:

```js
{
  key: "pricing",
  version: 1,
  source: {
    type: "csv" | "xlsx",
    filename: string | null,
    importedAt: "ISO-8601 timestamp"
  },
  data: { ... },
  meta: { ... }
}
```

Important distinction:

- DB version `2` is the IndexedDB schema version
- top-level record `version: 1` is the pricing record schema version

### Shared Pricing Record Shape

Under the new spec, `pricing` is not a FabricBOM-specific normalized row cache. It is the full shared pricing dataset record:

```js
{
  key: "pricing",
  version: 1,
  source: {
    type: "csv" | "xlsx",
    filename: string | null,
    importedAt: "ISO-8601 timestamp"
  },
  data: {
    ok: true,
    name: string,
    effectiveDate: string,
    headers: string[],
    rows: object[],
    uploadedAt: "ISO-8601 timestamp"
  },
  meta: {
    rowCount: number,
    headerCount: number,
    effectiveDate: string,
    datasetName: string
  }
}
```

### Shared Pricing Header Contract

The authoritative shared pricing dataset is valid only when `data.headers` contains the exact 39 required price-list headers in the original order, including exact casing and punctuation.

Examples that matter to the integration:

- `SKU`
- `Description #1`
- `Description #2`
- `Price`
- `Category`
- `Comments`

Practical rule:

- do not treat `Description #1`, `description1`, `description_1`, and `Description 1` as interchangeable inside the shared `pricing` record
- if FabricBOM needs a normalized in-memory lookup shape for search or pricing resolution, derive it from `data.rows` at runtime instead of redefining the stored shared contract

### FabricBOM Runtime Mapping

FabricBOM may still map the shared dataset into a local runtime view such as:

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

But that is an adapter concern only. It should not replace or mutate the shared stored record shape.

## Pricing Model

Pricing must continue to come from the shared workbook-derived dataset rather than a separate BOM-only pricing workflow.

Current integration behavior:

- SKU Finder workbook import is the canonical pricing source
- FortiSKU publishes the shared `pricing` dataset record into `toolbox_shared` / `datasets` / `pricing`
- embedded `FabricBOM` should read that shared dataset record from IndexedDB
- Project BOM pricing and custom SKU lookup should depend on that shared store
- FabricBOM standalone mode may also import the same workbook format and write into the same shared dataset contract
- embedded FabricBOM can derive its own normalized search/pricing map from the shared record's `data.rows`
- embedded FabricBOM should treat the source row's `Price` field as the pricing display source and only derive a numeric value for totals/calculation as an adapter concern

Practical rule:

- preserve the shared dataset seam during upstream refreshes
- do not reintroduce a separate CSV-based or BOM-only pricing workflow unless intentionally approved
- do not couple FabricBOM to FortiSKU's internal feature keys such as `fortisku-finder:*`
- do not let FabricBOM drift into a different IndexedDB object-store shape than SE Toolbox already uses

## Workbook Pricing Import Contract

For interoperability, both tools should normalize pricing from the same workbook-style source contract.

Required behavior:

- target default sheet name: `DataSet`
- if `DataSet` is absent, fall back to the first sheet
- detect the header row dynamically rather than assuming the first row
- require the full 39-column pricing header set for the canonical shared `pricing` record
- preserve the original header strings exactly as they appear in the source file
- skip empty rows
- trim and sanitize string values
- preserve `effectiveDate` exactly as it appears in the source file
- populate `data.name` from the source file and fall back to `Fortinet Price List` only when no recognizable name is present
- set `source.type` to `csv` or `xlsx` only
- store the full source rows keyed by the exact original header names

Compatibility note:

- FortiSKU may still produce a fallback normalized runtime dataset for local search when a workbook lacks the canonical 39 headers
- that fallback should not be treated as the authoritative shared `pricing` contract that FabricBOM depends on for upstream compatibility

Required headers:

- `Comments`
- `Identifier`
- `Product Family Group`
- `Product`
- `Product Type`
- `Item`
- `SKU`
- `Description #1`
- `Description #2`
- `Price`
- `Category`
- `Fx Translated Price`
- `UPC Code`
- `FED`
- `GSA`
- `COO`
- `Single Pack Weight (lbs.)`
- `Single Pack Length (in.)`
- `Single Pack Width (in.)`
- `Single Pack Height (in.)`
- `Case Pack Quantity`
- `Case Pack Weight (lbs.)`
- `Case Pack Length (in.)`
- `Case Pack Width (in.)`
- `Case Pack Height (in.)`
- `Ground Pallet Quantity`
- `Ground Pallet Weight (lbs.)`
- `Ground Pallet Length (in.)`
- `Ground Pallet Width (in.)`
- `Ground Pallet Height (in.)`
- `Air Pallet Quantity`
- `Air Pallet Weight (lbs.)`
- `Air Pallet Length (in.)`
- `Air Pallet Width (in.)`
- `Air Pallet Height (in.)`
- `AutoStart`
- `E-Rate`
- `Pillar`
- `Term (Month)`

Workbook metadata behavior:

- if a workbook contains `Cover Sheet`, `Cover`, or `Coversheet`, read cell `C7` when present and use it as the dataset name source when applicable
- set `source.type = "xlsx"` for workbook imports
- set `source.importedAt` to the import timestamp

Practical rule:

- treat the workbook import pipeline as the only shared pricing source of truth
- if upstream FabricBOM historically supported CSV pricing import, that should not be reintroduced as the shared workflow after refreshes
- if FabricBOM needs a workbook parser for standalone import, vendor the browser asset locally rather than depending on a CDN so the embedded route remains offline-capable

## Project BOM Pricing Resolution

Project BOM pricing behavior needs to stay aligned with FabricBOM's term model.

Required behavior:

- product generators emit co-term placeholder SKUs ending in `-DD`
- `pi-term` remains the only control that converts `-DD` to a priced term SKU
- if `pi-term = DD`, Project BOM should not guess a priced term for display or totals
- if `pi-term = 12`, `36`, or `60`, Project BOM should resolve pricing against that exact remapped SKU
- the list-price column should use the shared source row `Price` value when present
- if numeric totals are needed, parse them from the source row as an adapter concern rather than assuming the shared dataset stores a separate normalized display field

Practical rule:

- do not add fallback pricing that silently assumes `-12`, `-36`, or `-60` while the active term is still `DD`
- term selection must remain explicit and user-controlled through `pi-term`

## Upstream Source Of Truth

Use the public upstream repository as the default refresh source:

- canonical repository: `https://github.com/msalty/FabricBOM.git`
- default branch preference: use the upstream development branch when present; currently the public branch is `dev`
- do not refresh from personal forks unless that is expressly stated for the task
- if a previously documented branch such as `Development` is not present, verify the available upstream branches and record the branch and commit used
- do not preserve local vendored helper files when upstream now contains the correct shared data implementation; stale helpers can silently override the canonical contract

## Upstream Refresh Workflow

Recommended workflow for future updates:

1. refresh the vendored snapshot from the canonical `msalty/FabricBOM` repository
2. compare upstream changes against local wrapper assumptions and the shared data contract
3. preserve only the minimum local integration patches
4. verify:
   - embedded route loads
   - product navigation still works
   - Project BOM still works
   - Saved Projects still works
   - workbook-based shared pricing still resolves through `toolbox_shared` using DB version `2`
   - shared pricing reads/writes still use the `pricing` key in `datasets`
   - Pricing Dataset Search reads the shared `pricing` record through upstream's current `toolbox_shared` v2 implementation
   - custom SKU search still resolves after adapting from shared `data.rows`
   - Project BOM list price renders from the shared row `Price` value or a clearly derived equivalent
   - Project BOM totals only resolve against the exact term selected in `pi-term`
   - `DD` does not silently price as `-12`, `-36`, or `-60`
   - vendor-side workbook import works without CDN access
   - service worker asset list still matches vendored files
   - no refresh reintroduces legacy `fabricbom_pricing` dependence
   - no refresh downgrades the shared DB open path back to version `1`
   - no refresh restores the old `source.app` / `source.format` / `meta.schema` envelope as the stored shared contract
5. update this plan if the boundary changes

Practical rule:

- do not scatter `FabricBOM` edits across unrelated SE Toolbox files
- keep local changes concentrated in the wrapper, catalog bridge, theme bridge, shared dataset seam, and carefully chosen vendor patches

## What Must Remain Stable Across Upstream Pulls

When pulling a newer upstream `FabricBOM` snapshot, protect these integration expectations:

- FabricBOM reads pricing from `toolbox_shared` rather than `fabricbom_pricing`
- FabricBOM opens `toolbox_shared` with DB version `2`
- FabricBOM does not load stale local vendored helper files that open `toolbox_shared` with an older DB version
- FabricBOM reads the shared `pricing` record with top-level fields `key`, `version`, `source`, `data`, and `meta`
- FabricBOM treats `source.type` as `csv` or `xlsx`, not the older `app` / `format` / `label` shape
- FabricBOM derives any normalized runtime pricing rows from shared `data.rows` instead of expecting them to already be the stored contract
- FabricBOM standalone pricing import uses the workbook flow rather than a CSV-only path
- FabricBOM standalone pricing import loads its workbook parser from a vendored local asset, not a CDN dependency
- Pricing Dataset Search reads the shared `pricing` record through upstream's current `toolbox_shared` v2 implementation
- Custom SKU search uses an adapter built from the shared pricing dataset
- Project BOM totals use a numeric price derived from shared pricing rows
- Project BOM list price displays the shared `Price` value or a clearly derived equivalent
- Project BOM remaps `-DD` SKUs only when the user explicitly selects a term in `pi-term`
- `DD` remains an unpriced placeholder state rather than an implicit one-year selection
- BOM wrapper copy should continue describing pricing as shared workbook-backed data

If an upstream pull breaks any of these seams, restore the seam rather than pushing FabricBOM-specific storage rules deeper into FortiSKU.

## Naming Convention

Use `FabricBOM` in:

- SE Toolbox page copy
- README and project docs
- planning and migration docs
- status and UI messaging where the embedded tool is referenced by name

The legacy filesystem path `vendor/FortiBOM/` can remain temporarily until we intentionally perform a follow-up vendor-path rename.

That later rename should be treated as its own cleanup task because it will affect:

- wrapper iframe paths
- service worker cached URLs
- root service worker asset lists
- documentation references

## Migration Strategy

### Phase 1: Stable Upstream Wrapper

Keep the current wrapper-based integration healthy:

- SE Toolbox shell around embedded `FabricBOM`
- shared navigation into products and views
- shared workbook-backed dataset contract
- service-worker and asset alignment
- thin local styling bridge

Status:

- in progress and now materially advanced

### Phase 2: Harden The Boundary

Improve the wrapper and maintenance model:

- record upstream commit/version in a lightweight note if needed
- isolate any vendor patches we intentionally carry
- add a small validation checklist for upstream refreshes
- reduce stale `FortiBOM` naming in local docs and UI
- keep the shared dataset adapter seam narrow and well documented

### Phase 3: Selective Native Replacement

Only if it proves valuable, replace selected upstream product flows with native SE Toolbox modules.

Good candidates later:

- FortiGate
- FortiSwitch
- FortiAP

Criteria before replacing a product natively:

- the upstream flow is stable and well understood
- the SE Toolbox version would materially improve usability or maintainability
- the module can still emit normalized BOM rows compatible with the shared cart/export model

### Phase 4: Optional Vendor Path Cleanup

If we want naming consistency all the way down, rename the vendored folder from `vendor/FortiBOM/` to something like `vendor/FabricBOM/`.

Do this only as a deliberate follow-up after:

- wrapper paths are updated together
- cache keys and cached asset paths are updated together
- docs and references are updated together

## Immediate Next Steps

1. smoke-test `/bom-builder/` in the browser
2. verify one standard product flow end to end
3. verify `Search & Custom Entry` against the shared workbook-derived pricing dataset record
4. verify `Pricing Dataset Search` appears only when shared pricing data exists and reads from `toolbox_shared`
5. verify Project BOM pricing/export behavior
6. verify no stale local helper file is overriding upstream's current `toolbox_shared` v2 implementation
7. verify no legacy CSV-only pricing assumptions remain after upstream refresh
8. verify service worker cache invalidation whenever vendor helper assets or workbook parser assets change
9. decide whether to keep the vendor path as-is for now or schedule the path rename as a separate cleanup pass

## Strong Recommendation

Keep BOM Builder on the current path:

- upstream-synced `FabricBOM`
- SE Toolbox-owned shell
- shared workbook-derived pricing dataset via `toolbox_shared`
- minimal, well-contained integration patches

That is the best balance of maintainability, upgradeability, and speed right now.
