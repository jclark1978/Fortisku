# BOM Builder Integration Plan

## Goal

Add a new BOM Builder page to SE Toolbox that brings over the useful workflow from `FortiBOM` without importing its standalone app shell.

The end result should feel like a native SE Toolbox tool:

- shared SE Toolbox header and navigation
- shared light/dark theme behavior
- Fortinet-red accent styling aligned with the rest of the toolbox
- browser-only runtime with no backend
- modular feature structure inside `src/features/`

## Recommendation

Do not embed `FortiBOM` wholesale into SE Toolbox.

Why:

- `FortiBOM` is architected as its own self-contained app
- it includes its own top bar, sidebar, shell layout, and visual identity
- its product flows are split into standalone `products/*.html` files loaded through iframes
- most of its logic lives inline in page scripts rather than SE Toolbox-style feature modules

If we drop it in directly, SE Toolbox will feel like it contains a second app inside the app.

Instead, we should:

1. keep the BOM-building concepts and logic
2. rebuild the shell to match SE Toolbox
3. preserve a clean path for upstream updates
4. migrate product generators in phases

## Smarter Long-Term Model: Upstream Plugin Integration

If future updates from the original `FortiBOM` project matter, the best model is not a full rewrite first.

The better model is:

- keep `FortiBOM` as an upstream source
- add a thin SE Toolbox adapter layer around it
- let SE Toolbox own the page shell, route, nav, and theme
- let `FortiBOM` own its BOM-generation logic until we intentionally replace parts of it

This gives us a plugin-style integration instead of a hard fork.

### Why this is better

- new upstream features can be pulled in more easily
- SE Toolbox stays visually consistent
- we avoid copying a large inline app into the main codebase all at once
- we can replace pieces gradually instead of rewriting everything before we learn what matters most

## Recommended Plugin Structure

Recommended layout:

- `bom-builder/index.html`
- `src/features/bom-builder/`
  - `main.js`
  - `adapter.js`
  - `theme-bridge.css`
  - `shell.js`
  - `catalog.js`
  - `storage.js`
  - `integration/`
    - `fortibom-host.js`
    - `fortibom-events.js`
- `vendor/FortiBOM/`
  - upstream FortiBOM snapshot

### Ownership split

SE Toolbox-owned:

- page route
- shared header and top navigation
- SE Toolbox light/dark theme behavior
- page framing and native shell
- adapter logic
- style overrides / theme bridge
- future native module replacements

FortiBOM-owned initially:

- product generator HTML pages
- BOM row generation logic
- CSV import/export behavior
- cart semantics, where practical

## How the Plugin Model Would Work

### Page flow

1. User opens `/bom-builder/`
2. SE Toolbox renders the normal toolbox shell
3. SE Toolbox mounts a BOM Builder host area
4. The host loads FortiBOM content in a controlled integration container
5. Adapter code handles communication between SE Toolbox and the embedded BOM tool
6. Theme bridge CSS makes the embedded content look much closer to SE Toolbox

### Integration boundary

The boundary should be explicit:

- SE Toolbox wrapper page
- FortiBOM integration host
- adapter methods/events

That lets us later swap:

- full FortiBOM shell -> SE Toolbox-native shell
- individual product pages -> native SE Toolbox product modules

without rebuilding the whole tool in one pass

## Upstream Update Workflow

This is the main reason to prefer the plugin-style approach.

Recommended workflow:

1. keep a local vendored copy of `FortiBOM` under `vendor/FortiBOM/`
2. record the upstream commit or tag in a short note file
3. when your friend updates the project:
   - pull or refresh the vendored snapshot
   - review changes at the adapter boundary
   - test the BOM Builder route in SE Toolbox
4. only patch FortiBOM locally when truly necessary

### Practical rule

Do not scatter FortiBOM edits across SE Toolbox.

Keep local integration changes in:

- the wrapper page
- the adapter layer
- the theme bridge

That way upstream refreshes are manageable.

## Styling Strategy for Native Look

The easiest way to make it feel native without rewriting everything is to theme the embedded tool through a compatibility layer.

### Theme bridge approach

Create a BOM-specific bridge stylesheet that:

- maps FortiBOM colors toward SE Toolbox tokens
- removes or neutralizes the dark shell when embedded
- aligns cards, spacing, buttons, and tables with SE Toolbox
- keeps Fortinet red as the primary action color

Recommended file:

- `src/features/bom-builder/theme-bridge.css`

### Design goal

The user should feel like they are still inside SE Toolbox, not switching to another product.

That means:

- no separate dark app frame
- no second permanent global navigation
- no duplicate “app within app” top bar
- consistent panel backgrounds, borders, typography, and button language

## Best-Fit SE Toolbox Structure

Add a new canonical route:

- `/bom-builder/`

Recommended layout:

- `bom-builder/index.html`
- `src/features/bom-builder/`
  - `main.js`
  - `shell.js`
  - `adapter.js`
  - `catalog.js`
  - `cart.js`
  - `export.js`
  - `storage.js`
  - `theme-bridge.css`
  - `products/`
    - `fortigate.js`
    - `fortiswitch.js`
    - `fortiap.js`
    - etc.

If needed during migration:

- `src/features/bom-builder/iframe-host.js`

This keeps BOM Builder aligned with the current SE Toolbox architecture instead of introducing another standalone pattern.

## Architecture Decision

### What to keep from FortiBOM

- project BOM workflow
- product catalog concept
- project metadata capture
- CSV import/export
- drag-to-reorder groups and sections
- browser-only storage model
- per-product configurator concept

### What not to keep as-is

- FortiBOM dark top bar
- FortiBOM left sidebar app shell
- FortiBOM standalone visual identity
- large inline script organization
- long-term dependence on raw iframe product pages

## Migration Strategy

### Phase 1: Native SE Toolbox Host Page

Create a SE Toolbox-native BOM Builder page with:

- standard toolbox shell
- page intro and route wiring
- project metadata form
- BOM cart / project section
- import/export actions
- local persistence
- adapter boundary for FortiBOM content

At this phase, the page can exist even before all product generators are migrated.

### Phase 2: Temporary Product Integration

Bring in a small number of high-value products first.

Recommended first set:

1. FortiGate
2. FortiSwitch
3. FortiAP

These are likely to prove the model quickly and cover common SE workflows.

For the first pass, we can choose one of two paths:

- Preferred:
  convert product logic into SE Toolbox JS modules
- Faster temporary path:
  host selected FortiBOM product pages inside an internal BOM Builder content region while SE Toolbox owns the outer shell and adapter layer

My recommendation is to start with the adapter/plugin path first so you can absorb upstream changes, then replace individual products with native SE Toolbox modules only when they are stable and valuable enough to justify it.

### Phase 3: Product Module Refactor

Replace iframe-backed product pages with native SE Toolbox modules.

Each product module should expose a structured config definition or renderer and return normalized BOM rows to the shared BOM cart layer.

This gives us:

- shared validation patterns
- shared controls and styling
- easier maintenance
- easier future additions

### Phase 4: Expansion

Once the pattern is stable, migrate the remaining products:

- FortiAnalyzer
- FortiManager
- FortiNAC
- FortiAuthenticator
- FortiSASE
- FortiADC
- FortiFlex
- FortiClient
- FortiSandbox
- others as needed

## UI / UX Direction

### Overall Approach

The BOM Builder should match SE Toolbox's existing UI language instead of reusing FortiBOM's app chrome.

That means:

- use the shared top nav
- keep the page inside SE Toolbox's content width and shell
- use SE Toolbox panel styling and shared tokens
- keep interactions practical and dense, but not visually heavy

### Product Navigation

Do not carry over the permanent left sidebar.

Better options:

1. category chips + product selector
2. a two-column layout with:
   - narrower product/category rail inside the page
   - main configurator content on the right

My recommendation:

- use a page-local category strip and product picker at the top
- keep the BOM cart below or beside the configurator

This will feel more consistent with SE Toolbox than a second full app sidebar.

### Visual Redesign

Current FortiBOM look:

- dark shell
- gray-blue neutrals
- internal-app feel

Recommended SE Toolbox-aligned redesign:

- background: SE Toolbox surface neutrals
- cards: white / panel backgrounds already used in toolbox pages
- primary accent: Fortinet red
- secondary states: existing SE Toolbox muted grays
- keep status callouts, but reduce their color intensity slightly to match the rest of SE Toolbox

### Components to Reuse Stylistically

Keep these ideas, but restyle them:

- summary cards
- section headers
- configuration cards
- comparison tables
- BOM output tables
- action bars

### Tone

This page should feel like:

- an SE working tool
- dense but organized
- practical, not flashy
- clearly part of the same toolbox as LifeCycle, Asset Reports, and Ordering Guides

## Data / State Model

Shared BOM Builder state should likely include:

- selected product
- current product configuration
- project metadata
- product groups / line items
- grouping headers
- selected global term
- persisted cart state

Recommended storage:

- `localStorage` is acceptable for BOM cart/session state in phase 1
- if state complexity grows, we can move to IndexedDB later

For now, `localStorage` is simpler and matches the original tool's intent.

## Export Model

Keep support for:

- CSV export
- TSV copy/export
- print-friendly output
- CSV re-import

But centralize export logic into shared BOM Builder modules instead of leaving it embedded in page HTML.

## Recommended Phase 1 Deliverable

The first SE Toolbox implementation should include:

- `/bom-builder/` page
- shared SE Toolbox shell and navigation
- plugin host area for FortiBOM
- theme bridge styling
- project metadata form
- BOM cart area
- CSV import/export foundation
- one connected product flow

Best first product:

- FortiGate

Why:

- it is one of the most useful products
- it exercises the bundle/service logic well
- if FortiGate works cleanly, the plugin boundary will likely generalize

## Immediate Next Build Steps

1. Add `/bom-builder/` route and nav entry
2. Vendor `FortiBOM` into a controlled local path
3. Create `src/features/bom-builder/` scaffold
4. Build SE Toolbox-native shell for the BOM Builder page
5. Add adapter + theme bridge
6. Wire FortiGate as the first integrated product flow
7. Validate add-to-cart, reorder, export, and import flows
8. Then decide which pieces stay upstream-driven and which should become native SE Toolbox modules

## Strong Recommendation

If we want this to stay maintainable and updateable, the BOM Builder should become a SE Toolbox feature with an upstream-friendly plugin boundary, not a blind embed and not a full rewrite on day one.

That means:

- reuse concepts and logic
- do not reuse the standalone shell
- preserve the ability to pull in upstream changes
- migrate incrementally
- style it from SE Toolbox's shared UI system from day one
