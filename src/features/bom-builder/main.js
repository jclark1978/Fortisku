import { initThemeToggle } from "../../shared/ui/theme.js";
import { initToolboxNav } from "../../shared/ui/nav.js";
import { PRODUCT_CATALOG, findProductBySlug } from "./catalog.js";

const FORTIGATE_PRODUCT_PATH = "products/fortigate-bomgen.html";
const BRIDGE_STYLESHEET = new URL("./theme-bridge.css", import.meta.url).href;
const frame = document.getElementById("bom-builder-frame");
const projectButton = document.getElementById("bom-builder-project-button");
const statusEl = document.getElementById("bom-builder-status");
let heightSyncTimer = 0;
let themeObserver = null;
const initialProduct = resolveInitialProduct();
let activeProductPath = initialProduct.path;

initToolboxNav({ current: [`bom-product-${initialProduct.slug}`], basePath: "../" });
initThemeToggle();
startThemeSync();

frame?.addEventListener("load", () => {
  try {
    bridgeFortiBomShell();
    loadSelectedProduct(initialProduct.path, initialProduct.label);
    setStatus("success", `Embedded BOM workspace is ready. Starting in the ${initialProduct.label} configurator.`);
  } catch (error) {
    console.error("Failed to bridge FortiBOM shell", error);
    setStatus("warn", "The BOM workspace loaded, but the native Fortisku bridge could not be fully applied.");
  }
});

projectButton?.addEventListener("click", () => {
  showProjectBom();
  setStatus("info", "Showing the shared Project BOM workspace.");
});

function resolveInitialProduct() {
  const productSlug = new URL(window.location.href).searchParams.get("product");
  const selected = findProductBySlug(productSlug);
  if (selected) {
    return selected;
  }

  const fallback = PRODUCT_CATALOG.find((product) => product.path === FORTIGATE_PRODUCT_PATH) || PRODUCT_CATALOG[0];
  if (fallback) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("product", fallback.slug);
    window.history.replaceState({}, "", nextUrl);
  }
  return fallback;
}

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
