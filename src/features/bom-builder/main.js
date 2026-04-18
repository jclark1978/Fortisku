import { initThemeToggle } from "../../shared/ui/theme.js";
import { initToolboxNav } from "../../shared/ui/nav.js";

const FORTIBOM_APP_PATH = "../vendor/FortiBOM/index.html";
const FORTIGATE_PRODUCT_PATH = "products/fortigate-bomgen.html";
const BRIDGE_STYLESHEET = new URL("./theme-bridge.css", import.meta.url).href;
const PRODUCT_CATALOG = [
  { label: "FortiGate", path: "products/fortigate-bomgen.html", category: "Network Security" },
  { label: "FortiSASE", path: "products/fortisase-bomgen.html", category: "Network Security" },
  { label: "FortiSandbox", path: "products/fortisandbox-bomgen.html", category: "Network Security" },
  { label: "FortiADC", path: "products/fortiadc-bomgen.html", category: "Network Security" },
  { label: "FortiDeceptor", path: "products/fortideceptor-bomgen.html", category: "Network Security" },
  { label: "FortiWeb", path: "products/fortiweb-bomgen.html", category: "Network Security" },
  { label: "FortiAP", path: "products/fortiap-bomgen.html", category: "Network Access" },
  { label: "FortiSwitch", path: "products/fortiswitch-bomgen.html", category: "Network Access" },
  { label: "FortiClient", path: "products/forticlient-bomgen.html", category: "Endpoint Security" },
  { label: "FortiNAC", path: "products/fortinac-bomgen.html", category: "Access Control" },
  { label: "FortiAuthenticator", path: "products/fortiauthenticator-bomgen.html", category: "Access Control" },
  { label: "FortiAnalyzer", path: "products/fortianalyzer-bomgen.html", category: "Management" },
  { label: "FortiManager", path: "products/fortimanager-bomgen.html", category: "Management" },
  { label: "FortiAIOps", path: "products/fortiaiops-bomgen.html", category: "Management" },
  { label: "FortiMonitor", path: "products/fortimonitor-bomgen.html", category: "Management" },
  { label: "FortiSIEM", path: "products/fortisiem-bomgen.html", category: "Management" },
  { label: "FortiFlex", path: "products/fortiflex-bomgen.html", category: "Management" },
  { label: "Custom SKU", path: "products/custom-sku-bomgen.html", category: "Custom" },
  { label: "Placeholder", path: "products/placeholder-bomgen.html", category: "Demo" }
];
const frame = document.getElementById("bom-builder-frame");
const projectButton = document.getElementById("bom-builder-project-button");
const searchInput = document.getElementById("bom-builder-search-input");
const searchResults = document.getElementById("bom-builder-search-results");
const statusEl = document.getElementById("bom-builder-status");
let heightSyncTimer = 0;
let themeObserver = null;
let activeProductPath = FORTIGATE_PRODUCT_PATH;

initToolboxNav({ current: "bom-builder", basePath: "../" });
initThemeToggle();
startThemeSync();

frame?.addEventListener("load", () => {
  try {
    bridgeFortiBomShell();
    loadSelectedProduct(FORTIGATE_PRODUCT_PATH, "FortiGate");
    setStatus("success", "Embedded BOM workspace is ready. Starting in the FortiGate configurator.");
  } catch (error) {
    console.error("Failed to bridge FortiBOM shell", error);
    setStatus("warn", "The BOM workspace loaded, but the native Fortisku bridge could not be fully applied.");
  }
});

projectButton?.addEventListener("click", () => {
  showProjectBom();
  setStatus("info", "Showing the shared Project BOM workspace.");
});

searchInput?.addEventListener("input", () => {
  renderSearchResults(searchInput.value);
});

searchInput?.addEventListener("focus", () => {
  renderSearchResults(searchInput.value);
});

searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideSearchResults();
    searchInput.blur();
  }
});

document.addEventListener("click", (event) => {
  if (!searchResults || !searchInput) {
    return;
  }

  if (event.target === searchInput || searchResults.contains(event.target)) {
    return;
  }

  hideSearchResults();
});

function bridgeFortiBomShell() {
  const appWindow = frame?.contentWindow;
  const appDocument = frame?.contentDocument;
  if (!appWindow || !appDocument) {
    throw new Error("FortiBOM iframe is not available.");
  }

  injectBridgeStyles(appDocument);
  appDocument.documentElement.setAttribute("data-fortisku-bridge", "true");
  syncEmbeddedTheme(appDocument);

  const productFrame = appDocument.getElementById("pf");
  if (productFrame) {
    productFrame.addEventListener("load", () => {
      try {
        const productDocument = productFrame.contentDocument;
        if (productDocument) {
          injectBridgeStyles(productDocument);
          productDocument.documentElement.setAttribute("data-fortisku-bridge", "true");
          syncEmbeddedTheme(productDocument);
        }
      } catch (error) {
        console.warn("Failed to bridge FortiBOM product frame", error);
      }
      scheduleFrameHeightSync();
    });
  }

  scheduleFrameHeightSync();
}

function injectBridgeStyles(doc) {
  if (!doc?.head) {
    return;
  }

  let link = doc.getElementById("fortisku-bom-bridge");
  if (!link) {
    link = doc.createElement("link");
    link.id = "fortisku-bom-bridge";
    link.rel = "stylesheet";
    link.href = BRIDGE_STYLESHEET;
    doc.head.appendChild(link);
  }
}

function loadSelectedProduct(path, label) {
  const appWindow = frame?.contentWindow;
  if (!appWindow?.loadProduct) {
    return;
  }

  appWindow.loadProduct(path, label, null);
  activeProductPath = path;
  setSelectedMode("product");
  scheduleFrameHeightSync();
}

function showProjectBom() {
  const appWindow = frame?.contentWindow;
  if (!appWindow?.showPBV) {
    return;
  }

  appWindow.showPBV();
  setSelectedMode("project");
  scheduleFrameHeightSync();
}

function setSelectedMode(mode) {
  projectButton?.toggleAttribute("aria-current", mode === "project");
}

function renderSearchResults(query = "") {
  if (!searchResults || !searchInput) {
    return;
  }

  const normalizedQuery = String(query || "").trim().toLowerCase();
  const matches = PRODUCT_CATALOG
    .filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${item.label} ${item.category}`.toLowerCase().includes(normalizedQuery);
    });

  if (!matches.length) {
    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
    searchResults.innerHTML = `
      <div class="search-result-empty">
        No matching products. Try a different product name or category.
      </div>
    `;
    return;
  }

  searchResults.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  searchResults.innerHTML = matches.map((product) => `
    <button class="search-result-option" type="button" data-path="${product.path}"${product.path === activeProductPath ? ' aria-current="true"' : ""}>
      <span class="search-result-title">${product.label}</span>
      <span class="search-result-category">${product.category}</span>
    </button>
  `).join("");

  searchResults.querySelectorAll(".search-result-option").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = PRODUCT_CATALOG.find((item) => item.path === button.dataset.path);
      if (!selected) {
        return;
      }

      searchInput.value = selected.label;
      loadSelectedProduct(selected.path, selected.label);
      setStatus("info", `Showing the ${selected.label} configurator.`);
      hideSearchResults();
    });
  });
}

function hideSearchResults() {
  if (!searchResults || !searchInput) {
    return;
  }

  searchResults.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
  searchResults.innerHTML = "";
}

function setStatus(level, message) {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.className = `status-message ${level}`;
}

function syncFrameHeight() {
  const appDocument = frame?.contentDocument;
  if (!frame || !appDocument?.body) {
    return;
  }

  const bodyHeight = appDocument.body.scrollHeight || 0;
  const rootHeight = appDocument.documentElement?.scrollHeight || 0;
  const nextHeight = Math.max(980, bodyHeight, rootHeight);
  frame.style.height = `${nextHeight}px`;
}

function scheduleFrameHeightSync() {
  window.clearTimeout(heightSyncTimer);
  syncFrameHeight();
  heightSyncTimer = window.setTimeout(syncFrameHeight, 120);
  window.setTimeout(syncFrameHeight, 300);
}

function startThemeSync() {
  syncAllEmbeddedThemes();
  themeObserver?.disconnect();
  themeObserver = new MutationObserver(() => {
    syncAllEmbeddedThemes();
  });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

function syncAllEmbeddedThemes() {
  const appDocument = frame?.contentDocument;
  if (!appDocument) {
    return;
  }

  syncEmbeddedTheme(appDocument);
  const productDocument = appDocument.getElementById("pf")?.contentDocument;
  if (productDocument) {
    syncEmbeddedTheme(productDocument);
  }
}

function syncEmbeddedTheme(doc) {
  const theme = document.body.classList.contains("theme-dark") ? "dark" : "light";
  doc.documentElement.setAttribute("data-fortisku-theme", theme);
}

window.addEventListener("message", (event) => {
  const appWindow = frame?.contentWindow;
  const productFrameWindow = appWindow?.frames?.[0];
  if (!appWindow || (event.source !== appWindow && event.source !== productFrameWindow)) {
    return;
  }

  if (event.data?.type === "FORTIBOM_ADD") {
    setStatus("success", `Added ${event.data.label || "item"} to the embedded Project BOM.`);
    scheduleFrameHeightSync();
  }
});
