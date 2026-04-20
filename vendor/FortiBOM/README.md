# FabricBOM - Fortinet BOM Generation Tool

**Cross-product Bill of Materials generator for Fortinet deployments**

![Version](https://img.shields.io/badge/version-2.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Overview

FabricBOM is a client-side web application that helps Sales Engineers, Partner Engineers, and Customers build and export structured Bill of Materials quotes for Fortinet network security fabric deployments. Select from 15+ supported products, configure hardware models, support tiers, and licenses, then combine everything into a single exportable project BOM — no backend server or external dependencies required.  

Designed to be run offline with no further dependencies.  (Use the option to install web apps on most modern browsers and IOS / Android devices)

Disclaimer: FabricBOM is not an officially sanctioned Fortinet product. Always validate output against the official Fortinet product ordering guides.  All source and reference materials used in the creation of this product are public.

## Features

- **Multi-product hub** — 15+ Fortinet products organized by category in a sidebar navigation
- **Per-product configuration** — choose hardware model, quantity, FortiCare support tier, and add-on licenses for each product
- **Project BOM aggregation** — combine multiple product configurations into one quote with shared customer metadata (name, opportunity ID, SE name, date, project scope)
- **Global license term selection** — apply co-term, 1-year, 3-year, or 5-year terms to all SKUs at export time
- **Export options** — download as CSV, TSV, or use the print-optimized view for customer-ready output
- **Import & iterate** — re-import a previously exported CSV to continue editing a quote
- **Drag-to-reorder** — reorder product groups and line items within a project
- **Custom section headers** — insert labels (e.g., "Core Firewall", "Option A – SD-WAN") to organize complex quotes
- **Session persistence** — browser `localStorage` saves cart state across page refreshes

## Supported Products

| Category | Products |
|---|---|
| Network Security | Gate, SASE, FortiADC |
| Network Access | FortiSwitch, FortiAP |
| Endpoint Security | FortiClient, FortiSandbox, FortiAI Defend |
| Access Control | FortiNAC, FortiAuthenticator |
| Management | FortiManager, FortiAnalyzer, FortiFlex |
| Other | Custom SKU entry |

## Getting Started

**Requirements:** Any modern web browser. No installation, build step, or internet connection needed.

**Running locally:**

```bash
# Option 1 — open directly in browser
open index.html

# Option 2 — serve with any static file server
npx serve .
python3 -m http.server 8080
```

**Basic workflow:**

1. Select a product from the sidebar
2. Configure the hardware model, quantity, support tier, and any add-on licenses
3. Click **Add to Project BOM**
4. Repeat for each product in the quote
5. Fill in project metadata (customer name, opportunity ID, etc.)
6. Select the license term and export as CSV or print

## Architecture

FabricBOM is intentionally dependency-free — everything runs in the browser with plain HTML, CSS, and JavaScript.

```
FabricBOM/
├── index.html          # Main hub shell and project BOM cart
└── products/           # Self-contained per-product BOM generators
    ├── fortigate-bomgen.html
    ├── fortiswitch-bomgen.html
    └── ...
```

- **`index.html`** hosts the sidebar, project metadata form, and BOM cart
- **`products/*.html`** are embedded as iframes; each is a standalone configurator
- **PostMessage API** carries BOM data from product iframes to the parent hub
- **SKU convention** — all internal SKUs use a `-DD` suffix; the parent substitutes the correct term (`-12`, `-36`, `-60`) on export

## License

[MIT](LICENSE) — 2026 msalty
