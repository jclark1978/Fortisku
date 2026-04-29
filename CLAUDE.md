# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

No build step or package install is needed. All vendor dependencies are pre-bundled in `/vendor/`.

```bash
# Start dev server (Python http.server on port 5173)
./start_server.sh

# Stop dev server
./stop_server.sh
```

Or directly: `python3 -m http.server 5173`

There are no lint, test, or compile commands — this is a static site served as-is.

## Architecture

SE Toolbox is a **vanilla JavaScript ES modules** application with no framework, no build tooling, and no package manager. All logic runs in the browser; data never leaves the user's machine.

### Entry Points

Each tool is an independent HTML page that imports its own `main.js`:

| Route | Entry Point |
|---|---|
| `/` | `index.html` — SKU Finder + landing |
| `/bom-builder/` | `bom-builder/index.html` — FabricBOM wrapper |
| `/hardware-lifecycle/` | `hardware-lifecycle/index.html` |
| `/software-lifecycle/` | `software-lifecycle/index.html` |
| `/ordering-guides/` | `ordering-guides/index.html` |
| `/asset-reports/` | `asset-reports/index.html` |
| `/lab-portal/` | `lab-portal/index.html` |

Legacy top-level HTML files (`asset-report.html`, etc.) are redirect stubs only.

### Source Layout

```
src/
├── features/           # One directory per tool/surface
│   ├── sku-finder/     # Workbook ingestion, MiniSearch, BOM drawer
│   ├── bom-builder/    # FabricBOM iframe bridge and theme integration
│   ├── hardware-lifecycle/
│   ├── software-lifecycle/
│   ├── ordering-guides/
│   └── asset-reports/
└── shared/
    ├── data/           # workbook.js, search.js, storage.js, csv.js
    ├── lifecycle/      # startLifecycleApp() factory used by both lifecycle tools
    └── ui/             # Design tokens, themes, nav, shared component CSS
vendor/                 # xlsx.mjs, minisearch.min.js, idb-keyval.mjs, FortiBOM/
```

### State & Persistence

- **IndexedDB** via `idb-keyval.mjs` for dataset rows, MiniSearch indexes, and metadata
- Key pattern: `fortisku-{feature}:{data-type}:v{SCHEMA_VERSION}` (current schema version: `"4"`)
- Module-scoped closures and plain objects for in-memory state — no state management library
- `localStorage` for theme and appearance preferences

### Search

MiniSearch (`vendor/minisearch.min.js`) backs all full-text search. Query syntax: spaces = AND, `|` or `OR` keyword = OR. Results are hard-capped at 200 rows for rendering performance.

### Design System

Three switchable design themes, each with light/dark color modes:

- **Soltesz** (default) — Red-accented editorial enterprise
- **FortiGate** — Green-accented tactical command center
- **Forge** — FabricBOM branding

CSS lives entirely in `src/shared/ui/`:
- `tokens.css` — CSS custom properties (the single source of truth for spacing, color, type)
- `themes.css` — Per-theme color overrides
- `theme-init.js` — Runs inline before DOM load to apply stored theme without flash
- `theme.js` — Runtime switcher and appearance menu

When adding new UI, consume tokens from `tokens.css` rather than hard-coding values.

### Service Worker

`sw.js` at the root caches the app shell for offline use. Cache name is `fortisku-cache-v{N}` — increment `N` when adding or renaming cached assets.

### BOM Builder / FabricBOM

`/bom-builder/` wraps the vendored FabricBOM workspace (`vendor/FortiBOM/`) in an iframe. `src/features/bom-builder/` contains the bridge that injects SE Toolbox theme tokens into the iframe and shares pricing data with SKU Finder.

## Deployment

Azure Static Web Apps CI/CD (`.github/workflows/`). Merge to `main` triggers production deploy; PRs get staging environments. No build step in the pipeline — the repo root is served directly.
