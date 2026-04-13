# Project Summary

## Overview

Fortisku is a static, browser-only toolkit for working with Fortinet spreadsheet-based data and lightweight internal workflows. It runs entirely client-side, uses no backend, and can be served from any simple static host.

The project started as a SKU finder and has grown into a small suite of related tools:

- FortiSKU Finder
- LifeCycle lookup
- Ordering Guides lookup
- Asset Report builder
- Lab Portal Generator

All workbook processing happens in the browser. Persisted data is stored locally in IndexedDB, and vendored browser dependencies are included directly in the repository.

## Current Architecture

The codebase is now organized by feature instead of keeping every page module flat in `src/`.

### Top-level pages

- `index.html`
  - Main FortiSKU Finder page
- `lifecycle/`
  - Canonical LifeCycle lookup page
- `ordering-guides/`
  - Canonical Ordering Guides page
- `asset-reports/`
  - Canonical Asset Report builder page
- `lab-portal/`
  - Canonical Lab Portal Generator page

Canonical browser routes are:

- `/`
- `/lifecycle/`
- `/ordering-guides/`
- `/asset-reports/`
- `/lab-portal/`

Legacy page URLs are still present only as lightweight redirect files for backward compatibility:

- `lifecycle.html`
- `ordering.html`
- `asset-report.html`
- `Lab-Portal-Generator.html`

### Source layout

- `src/features/finder/`
  - Main SKU finder logic, UI, BOM support
- `src/features/lifecycle/`
  - LifeCycle workbook ingestion, storage, search, UI
- `src/features/ordering-guides/`
  - Ordering Guide page logic and UI
- `src/features/asset-reports/`
  - Asset workbook inspection and report generation
- `src/shared/data/`
  - Shared ingestion, search, storage, and CSV helpers
- `src/shared/ui/`
  - Shared UI helpers like theme handling
- `vendor/`
  - Vendored client-side dependencies:
    - `xlsx`
    - `minisearch`
    - `idb-keyval`

## Main Workflows

### 1. FortiSKU Finder

Primary page: `index.html`

Purpose:
- Upload a Fortinet price list workbook
- Normalize workbook data into a standard SKU row format
- Build a client-side search index
- Search SKU and description data quickly
- Export full results or filtered results to CSV
- Build a bill of materials with quantity and discount support

Key modules:
- `src/features/finder/main.js`
- `src/features/finder/ui.js`
- `src/features/finder/bom.js`
- `src/features/finder/bomExport.js`
- `src/shared/data/ingest.js`
- `src/shared/data/search.js`
- `src/shared/data/storage.js`
- `src/shared/data/csv.js`

### 2. LifeCycle Lookup

Primary page: `lifecycle/index.html`

Purpose:
- Upload a lifecycle workbook
- Store normalized lifecycle rows in IndexedDB
- Search lifecycle-specific records through a dedicated UI

Key modules:
- `src/features/lifecycle/main.js`
- `src/features/lifecycle/ingest.js`
- `src/features/lifecycle/search.js`
- `src/features/lifecycle/storage.js`
- `src/features/lifecycle/ui.js`

### 3. Ordering Guides

Primary page: `ordering-guides/index.html`

Purpose:
- Reuse uploaded price list data
- Extract ordering guide rows
- Search ordering guide and related product text

Key modules:
- `src/features/ordering-guides/main.js`
- `src/features/ordering-guides/ui.js`
- `src/shared/data/ingest.js`
- `src/shared/data/storage.js`

### 4. Asset Reports

Primary page: `asset-reports/index.html`

Purpose:
- Load an asset workbook
- Inspect and summarize source data
- Generate an output workbook for customer-facing reporting

Key modules:
- `src/features/asset-reports/main.js`
- `src/features/asset-reports/ui.js`
- `src/features/asset-reports/workbook.js`

### 5. Lab Portal Generator

Primary page: `lab-portal/index.html`

Purpose:
- Provide a standalone browser-based generator workflow for lab portal content

Notes:
- This page remains largely self-contained in HTML today and may be a good candidate for future extraction into `src/features/lab-portal/` if it grows further.

## Storage and Runtime Model

- No backend services are required
- No build step is required
- The app can be served using `python3 -m http.server`
- IndexedDB is used for persisted workbook/search data
- A service worker in `sw.js` provides optional offline caching

## Deployment

Deployment is currently handled as a static site through GitHub and Azure Static Web Apps workflows in `.github/workflows/`.

## Security and Data Handling

- Workbook data stays client-side during app use
- `Sample_Files/` is now ignored by git and no longer tracked
- Sensitive example files should not be committed back into the repository
- If older sensitive files were committed previously, they still remain in git history unless history is rewritten separately

## Development Notes

- Serve locally from the repo root:

```bash
cd /home/clarks/fortisearch/Fortisku
./start_server.sh
```

Or:

```bash
python3 -m http.server 5173
```

- Main entry URLs:
  - `/`
  - `/lifecycle/`
  - `/ordering-guides/`
  - `/asset-reports/`
  - `/lab-portal/`

- Legacy file-based URLs should not be used for new links or documentation.

## Recommended Next Steps

- Extract the Lab Portal Generator into its own `src/features/lab-portal/` module set
- Introduce a shared style system instead of repeating large inline page styles
- Add lightweight smoke-test documentation for future changes
- Add a small automated test strategy for pure logic modules like search, ingest, and storage helpers
- Consider switching the repo remote to SSH permanently for smoother pushes from this environment
