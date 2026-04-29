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

- the vendored upstream snapshot has been refreshed from the forked `Development` branch derived from `msalty/FabricBOM`
- the BOM Builder wrapper still embeds the vendored app through `/bom-builder/`
- SE Toolbox navigation can now reach the newer upstream products
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
- schema version: `1`
- object store: `datasets`
- object store keying: treat `datasets` as key-path-backed on `key`

Implementation note:

- SE Toolbox currently creates `datasets` with `{ keyPath: "key" }`
- vendor-side helper code must remain compatible with that shape
- do not assume a keyless object store plus explicit `.put(payload, key)` calls
- when saving shared datasets, prefer writing `{ ...payload, key }` and support `store.keyPath === "key"` safely

Dataset keys:

- `pricing`
- `hardware_lifecycle`
- `software_lifecycle`

### Dataset Envelope

Each dataset record stored in `datasets` should follow this shape:

```js
{
  key: "pricing",
  version: 1,
  source: {
    app: "FortiSKU" | "FabricBOM" | string,
    format: "xlsx" | "rss" | string,
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

The normalized `pricing` dataset rows should use:

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

The normalized lifecycle datasets should use:

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

## Pricing Model

Pricing must continue to come from the shared workbook-derived dataset rather than a separate BOM-only pricing workflow.

Current integration behavior:

- SKU Finder workbook import is the canonical pricing source
- FortiSKU publishes normalized pricing rows into `toolbox_shared` / `datasets` / `pricing`
- embedded `FabricBOM` should read that normalized dataset from IndexedDB
- Project BOM pricing and custom SKU lookup should depend on that shared store
- FabricBOM standalone mode may also import the same workbook format and write into the same shared dataset contract
- embedded FabricBOM should treat `priceDisplay` as preferred presentation data but fall back to formatted numeric `price` when `priceDisplay` is empty or placeholder-only

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
- require both SKU and primary description columns
- accept header synonyms
- skip empty rows
- trim and sanitize string values
- parse numeric price when possible
- preserve the original display string for price
- sort normalized rows by `sku`

Header mapping:

- `sku`: `sku`, `product_sku`, `part`, `partnumber`
- `description1`: `description`, `description#1`, `description1`, `desc`, `itemdescription`, `productdescription`
- `description2`: `description#2`, `description2`, `desc2`, `itemdescription2`, `productdescription2`, `secondarydescription`
- `price`: `price`, `listprice`, `unitprice`, `msrp`, `usdprice`
- `category`: `category`, `productcategory`, `family`, `productfamily`, `familyname`, `productline`, `bundle`, `solution`, `segment`, `portfolio`
- `comments`: `comments`, `comment`, `notes`, `note`

Workbook metadata behavior:

- if a workbook contains `Cover Sheet`, `Cover`, or `Coversheet`, read cell `C7` when present and use it as `source.label`
- set `source.format = "xlsx"`
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
- the list-price column should use `priceDisplay` when present
- if `priceDisplay` is blank or placeholder-only (for example `-`), the list-price column should render a formatted value from numeric `price`

Practical rule:

- do not add fallback pricing that silently assumes `-12`, `-36`, or `-60` while the active term is still `DD`
- term selection must remain explicit and user-controlled through `pi-term`

## Upstream Refresh Workflow

Recommended workflow for future updates:

1. refresh the vendored snapshot from `msalty/FabricBOM`
2. compare upstream changes against local wrapper assumptions and the shared data contract
3. preserve only the minimum local integration patches
4. verify:
   - embedded route loads
   - product navigation still works
   - Project BOM still works
   - Saved Projects still works
   - workbook-based shared pricing still resolves through `toolbox_shared`
   - custom SKU search still resolves against normalized pricing rows
   - Project BOM list price renders from `priceDisplay` or formatted numeric `price`
   - Project BOM totals only resolve against the exact term selected in `pi-term`
   - `DD` does not silently price as `-12`, `-36`, or `-60`
   - vendor-side workbook import works without CDN access
   - service worker asset list still matches vendored files
   - no refresh reintroduces legacy `fabricbom_pricing` dependence
5. update this plan if the boundary changes

Practical rule:

- do not scatter `FabricBOM` edits across unrelated SE Toolbox files
- keep local changes concentrated in the wrapper, catalog bridge, theme bridge, shared dataset seam, and carefully chosen vendor patches

## What Must Remain Stable Across Upstream Pulls

When pulling a newer upstream `FabricBOM` snapshot, protect these integration expectations:

- FabricBOM reads pricing from `toolbox_shared` rather than `fabricbom_pricing`
- FabricBOM expects normalized `pricing` rows with `sku`, `description1`, `description2`, `price`, `priceDisplay`, `category`, and `comments`
- FabricBOM standalone pricing import uses the workbook flow rather than a CSV-only path
- FabricBOM standalone pricing import loads its workbook parser from a vendored local asset, not a CDN dependency
- Custom SKU search uses the normalized pricing dataset
- Project BOM totals use the normalized numeric `price` field
- Project BOM list price displays `priceDisplay` when valid and falls back to formatted numeric `price`
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
3. verify `Search & Custom Entry` against the shared workbook-derived pricing dataset
4. verify Project BOM pricing/export behavior
5. verify no legacy CSV-only pricing assumptions remain after upstream refresh
6. verify service worker cache invalidation whenever vendor helper assets or workbook parser assets change
7. decide whether to keep the vendor path as-is for now or schedule the path rename as a separate cleanup pass

## Strong Recommendation

Keep BOM Builder on the current path:

- upstream-synced `FabricBOM`
- SE Toolbox-owned shell
- shared workbook-derived pricing dataset via `toolbox_shared`
- minimal, well-contained integration patches

That is the best balance of maintainability, upgradeability, and speed right now.
