# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the main FortiSKU Finder UI; `lifecycle.html` is the lifecycle lookup UI.
- `src/` contains all application logic (ingest, search, storage, UI, BOM, lifecycle flows).
- `vendor/` holds vendored browser dependencies (MiniSearch, idb-keyval, xlsx).
- `sw.js` is the optional service worker for offline caching.

## Build, Test, and Development Commands
- No build step is required; this is a static, browser-only app.
- Serve locally with any static server, for example:
  - `cd fortisku-browser`
  - `python -m http.server 5173`
- Then open `http://localhost:5173` (or `http://localhost:5173/lifecycle.html`).

## Coding Style & Naming Conventions
- JavaScript uses ES modules; prefer `import`/`export` in `src/`.
- Use 2-space indentation for HTML/CSS/JS (matches existing files).
- Prefer `camelCase` for functions and variables (e.g., `buildCsvFilename`).
- Keep UI strings and DOM selectors near the related UI module (`src/ui.js`).

## Testing Guidelines
- No automated test framework is set up yet.
- If you add tests, document the runner in `README.md` and use clear names like
  `search.test.js` or `storage.test.js`.

## Commit & Pull Request Guidelines
- Existing history uses short, imperative messages and occasional `feat:` prefixes.
  Follow that style (e.g., `feat: Add lifecycle workbook lookup`).
- PRs should include a short description, screenshots for UI changes, and note any
  data/compatibility impacts (e.g., changes to IndexedDB schema or CSV output).

## Security & Configuration Tips
- All data is client-side; avoid uploading real customer data when demoing.
- If you change cached assets, update `APP_SHELL` and bump `CACHE_NAME` in `sw.js`.
