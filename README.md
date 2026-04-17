# Fortinet SE Toolbox

Fortinet SE Toolbox is a static, browser-only suite of utilities for common Fortinet SE workflows. It currently includes FortiSKU Finder, Hardware LifeCycle lookup, Software LifeCycle lookup, Ordering Guides lookup, Asset Reports, and the Lab Portal Generator.

## Features

- FortiSKU Finder for pricelist ingestion, search, export, and BOM building
- Hardware LifeCycle lookup for milestone and support-planning searches using the Fortinet RSS feed
- Software LifeCycle lookup for release and support milestone searches using the Fortinet RSS feed
- Ordering Guides lookup for cross-referencing guides and related products
- Asset Report generation from customer workbook inputs
- Lab Portal Generator for demo portal handoff workflows
- IndexedDB persistence and optional offline-capable caching

## Getting Started

### 1. Install dependencies

No build step or package install is required. All vendor dependencies are vendored in `/vendor`.

### 2. Run locally

Serve the project root with any static file server. One simple option:

```bash
python -m http.server 5173
```

Then open [http://localhost:5173](http://localhost:5173) in a modern browser.

### 3. Deploy

Upload the contents of this repository to any static host:

- **GitHub Pages:** push the folder to a `gh-pages` branch.
- **Netlify/Vercel:** drag-and-drop the folder or point the site to it.
- **S3/CloudFront, Firebase Hosting, nginx, etc.:** copy the folder as-is.

No backend or server-side computation is required.

## Project Layout

- `index.html` is the main FortiSKU Finder experience and current landing page for the toolbox.
- `hardware-lifecycle/`, `software-lifecycle/`, `ordering-guides/`, `asset-reports/`, and `lab-portal/` each contain a page entrypoint for a separate workflow.
- `src/features/` groups browser logic by product surface:
  - `finder/`
  - `hardware-lifecycle/` for the RSS-based hardware lifecycle flow
  - `software-lifecycle/` for the RSS-based software lifecycle flow
  - `ordering-guides/`
  - `asset-reports/`
- `src/shared/data/` contains workbook/search/storage helpers shared across pages.
- `src/shared/lifecycle/` contains shared lifecycle controller and search helpers used by both lifecycle tools.
- `src/shared/ui/` contains shared shell assets such as theme handling, nav generation, and shared toolbox page styling.
- `vendor/` contains vendored browser dependencies.

Primary routes are:

- `/`
- `/hardware-lifecycle/`
- `/software-lifecycle/`
- `/ordering-guides/`
- `/asset-reports/`
- `/lab-portal/`

The optional `/fortisku/` route can be kept as a compatibility alias, but `/` remains the primary finder entrypoint.

Legacy top-level page URLs such as `asset-report.html` are kept only as lightweight redirects for backward compatibility.

## Usage Notes

1. Open `/` to use FortiSKU Finder, or jump to the other tools from the shared top navigation.
2. In FortiSKU Finder, upload an Excel workbook (.xlsx). By default, the app targets the `DataSet` sheet; provide an alternative sheet name if needed.
3. The workbook is parsed entirely in the browser. FortiSKU Finder auto-detects the first row containing SKU/Description headers (so banner rows can stay) and skips rows lacking SKU or Description #1.
4. After the first upload, the normalized rows, MiniSearch index, and metadata persist in IndexedDB. Reloading the page resumes instantly.
5. Use spaces for AND searches across Description #1/#2 (e.g. `FortiGate 90G Enterprise bdl`). Add `OR` (or `|`) for alternatives, such as `FortiGate (90G OR 70F) Enterprise bdl`. Results are capped at 200 rows for fast rendering.
6. Use the `+` button beside any SKU to add it to the BOM. Quantities are prompted on add, and you can adjust them from the drawer. A `–` button removes the SKU; the drawer also offers a trash icon per line.
7. Export either the full dataset or the visible search results to CSV at any time.

## Storage & Clearing Data

- IndexedDB persistence means large datasets consume browser storage. Most browsers allow hundreds of megabytes, but quotas vary.
- The dataset panel shows an approximate byte size (rows + index JSON).
- Use **Clear stored data** to wipe IndexedDB entries and return to an empty state. You can also clear site data from browser settings if needed.

---

All operations remain client-side. Data never leaves the user's machine, ensuring portability and offline resilience.
