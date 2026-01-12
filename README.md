# FortiSKU Finder

FortiSKU Finder is a static, browser-only tool for exploring Fortinet SKU price lists. Upload an Excel workbook once, and all data stays in IndexedDB for instant, offline-capable search with MiniSearch full-text indexing.

## Features

- Excel ingestion (XLSX) with header normalization into a standardized SKU schema
- Client-side MiniSearch index with AND + prefix search across Description #1 and Description #2
- IndexedDB persistence (via `idb-keyval`) so data survives reloads
- CSV export for the full dataset or current search results
- Interactive Bill of Materials drawer with per-line quantities, optional discounts, and CSV export
- Accessible, lightweight UI with copy helpers for SKU and price fields
- Search results show SKU, Description #1/#2, Price, and Category columns for quick scans
- Optional service worker to cache the app shell and vendor bundles for offline use

## Getting Started

### 1. Install dependencies

No build step or package install is required. All vendor dependencies are vendored in `/vendor`.

### 2. Run locally

Serve the `fortisku-browser` directory with any static file server. One simple option:

```bash
cd fortisku-browser
python -m http.server 5173
```

Then open [http://localhost:5173](http://localhost:5173) in a modern browser.

### 3. Deploy

Upload the contents of `fortisku-browser/` to any static host:

- **GitHub Pages:** push the folder to a `gh-pages` branch.
- **Netlify/Vercel:** drag-and-drop the folder or point the site to it.
- **S3/CloudFront, Firebase Hosting, nginx, etc.:** copy the folder as-is.

No backend or server-side computation is required.

## Usage Notes

1. Upload an Excel workbook (.xlsx). By default, the app targets the `DataSet` sheet; provide an alternative sheet name if needed.
2. The workbook is parsed entirely in the browser. FortiSKU Finder auto-detects the first row containing SKU/Description headers (so banner rows can stay) and skips rows lacking SKU or Description #1.
3. After the first upload, the normalized rows, MiniSearch index, and metadata persist in IndexedDB. Reloading the page resumes instantly.
4. Use spaces for AND searches across Description #1/#2 (e.g. `FortiGate 90G Enterprise bdl`). Add `OR` (or `|`) for alternatives, such as `FortiGate (90G OR 70F) Enterprise bdl`. Results are capped at 200 rows for fast rendering.
5. Use the `+` button beside any SKU to add it to the BOM. Quantities are prompted on add, and you can adjust them from the drawer. A `–` button removes the SKU; the drawer also offers a trash icon per line.
6. Open the BOM drawer to review totals or export to CSV. Open the full-screen view to edit per-line discount percentages before exporting.
7. Export either the full dataset or the visible search results to CSV at any time.
8. Copy buttons next to SKU and Price use the Clipboard API for quick sharing.

## Storage & Clearing Data

- IndexedDB persistence means large datasets consume browser storage. Most browsers allow hundreds of megabytes, but quotas vary.
- The dataset panel shows an approximate byte size (rows + index JSON).
- Use **Clear stored data** to wipe IndexedDB entries and return to an empty state. You can also clear site data from browser settings if needed.

---

All operations remain client-side. Data never leaves the user's machine, ensuring portability and offline resilience.
