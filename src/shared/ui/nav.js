import { groupCatalogByCategory } from "../../features/bom-builder/catalog.js";
import { initAdminAlerts } from "./admin-alerts.js";

const SHELL_COLLAPSED_KEY = "fortisku-shell-collapsed";

const ICONS = {
  search: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
  layers: `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`,
  refreshCw: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>`,
  bookOpen: `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
  eraser: `<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>`,
  flaskConical: `<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>`,
  chevDown: `<polyline points="6,9 12,15 18,9"/>`,
  chevRight: `<polyline points="9,18 15,12 9,6"/>`,
  chevLeft: `<polyline points="15,18 9,12 15,6"/>`,
};

function icon(name, size = 16) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

function categoryKey(category) {
  return `bom-category-${String(category).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const TOOLBOX_ITEMS = [
  { key: "sku-finder", label: "SKU Finder", href: "", icon: "search" },
  {
    key: "bom-builder",
    label: "BOM Builder",
    icon: "layers",
    children: [
      { key: "bom-project", label: "Project BOM", href: "bom-builder/?view=project" },
      { key: "bom-saved", label: "Saved Projects", href: "bom-builder/?view=saved" },
      ...groupCatalogByCategory().map(({ category, products }) => ({
        key: categoryKey(category),
        label: category,
        children: products.map((product) => ({
          key: `bom-product-${product.slug}`,
          label: product.label,
          href: `bom-builder/?product=${encodeURIComponent(product.slug)}`
        }))
      }))
    ]
  },
  {
    key: "lifecycle",
    label: "LifeCycle",
    icon: "refreshCw",
    children: [
      { key: "hardware-lifecycle", label: "Hardware LifeCycle", href: "hardware-lifecycle/" },
      { key: "software-lifecycle", label: "Software LifeCycle", href: "software-lifecycle/" }
    ]
  },
  { key: "ordering-guides", label: "Ordering Guides", href: "ordering-guides/", icon: "bookOpen" },
  { key: "asset-reports", label: "Asset Report Cleanup", href: "asset-reports/", icon: "eraser" },
  { key: "lab-portal", label: "Lab Portal Generator", href: "lab-portal/", icon: "flaskConical" }
];

function normalizeCurrent(current) {
  if (Array.isArray(current)) return new Set(current.filter(Boolean));
  return new Set(current ? [current] : []);
}

function nodeHasCurrent(node, currentKeys) {
  if (currentKeys.has(node.key)) return true;
  return Array.isArray(node.children) && node.children.some((child) => nodeHasCurrent(child, currentKeys));
}

function findActiveToolLabel(currentKeys) {
  for (const item of TOOLBOX_ITEMS) {
    if (nodeHasCurrent(item, currentKeys)) return item.label;
  }
  return "SE Toolbox";
}

// ── RENDER FUNCTIONS ───────────────────────────────────────────────────

function renderTopLink(link, normalizedBase, currentKeys) {
  const href = link.href !== undefined ? `${normalizedBase}${link.href}` : normalizedBase;
  const currentAttr = currentKeys.has(link.key) ? ' aria-current="page"' : "";
  return `<a class="forti-nav-link" href="${href}"${currentAttr}>
    <div class="forti-nav-acc"></div>
    <span class="forti-nav-icon">${link.icon ? icon(link.icon) : ""}</span>
    <span class="forti-nav-label">${link.label}</span>
  </a>`;
}

function renderTopGroup(item, normalizedBase, currentKeys) {
  const isCurrent = item.children.some((child) => nodeHasCurrent(child, currentKeys));
  const expandedAttr = isCurrent ? "true" : "false";
  const currentAttr = isCurrent ? ' data-current="true"' : "";
  const chevronClass = `forti-nav-chevron${isCurrent ? " open" : ""}`;
  const children = item.children
    .map((child) => renderSubNode(child, normalizedBase, currentKeys))
    .join("");

  return `<div class="forti-nav-group"${currentAttr}>
    <button class="forti-nav-group-trigger forti-nav-link" type="button" aria-expanded="${expandedAttr}">
      <div class="forti-nav-acc"></div>
      <span class="forti-nav-icon">${item.icon ? icon(item.icon) : ""}</span>
      <span class="forti-nav-label">${item.label}</span>
      <span class="${chevronClass}">${icon("chevDown", 12)}</span>
    </button>
    <div class="forti-nav-group-menu">
      ${children}
    </div>
  </div>`;
}

function renderSubNode(node, normalizedBase, currentKeys) {
  if (node.children?.length) {
    return renderCatGroup(node, normalizedBase, currentKeys);
  }
  return renderSubLink(node, normalizedBase, currentKeys);
}

function renderSubLink(link, normalizedBase, currentKeys) {
  const href = link.href !== undefined ? `${normalizedBase}${link.href}` : normalizedBase;
  const currentAttr = currentKeys.has(link.key) ? ' aria-current="page"' : "";
  return `<a class="forti-nav-subitem" href="${href}"${currentAttr}>
    ${icon("chevRight", 10)}
    ${link.label}
  </a>`;
}

function renderCatGroup(item, normalizedBase, currentKeys) {
  const products = item.children
    .map((child) => {
      const href = child.href !== undefined ? `${normalizedBase}${child.href}` : normalizedBase;
      const currentAttr = currentKeys.has(child.key) ? ' aria-current="page"' : "";
      return `<a class="forti-nav-product" href="${href}"${currentAttr}>
        <span class="forti-nav-dot"></span>
        ${child.label}
      </a>`;
    })
    .join("");

  return `<div class="forti-nav-cat-group">
    <div class="forti-nav-cat-label">${item.label}</div>
    ${products}
  </div>`;
}

function renderNode(node, normalizedBase, currentKeys) {
  if (node.children?.length) return renderTopGroup(node, normalizedBase, currentKeys);
  return renderTopLink(node, normalizedBase, currentKeys);
}

// ── SHELL BUILDER ──────────────────────────────────────────────────────

function preferredCollapsed() {
  return window.localStorage.getItem(SHELL_COLLAPSED_KEY) === "true";
}

function setCollapsed(collapsed) {
  const sidebar = document.querySelector(".forti-sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("forti-sidebar-rail", collapsed);
  window.localStorage.setItem(SHELL_COLLAPSED_KEY, collapsed ? "true" : "false");
  const toggle = document.getElementById("forti-shell-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
    const svgEl = toggle.querySelector("svg");
    if (svgEl) {
      svgEl.innerHTML = collapsed ? ICONS.chevRight : ICONS.chevLeft;
    }
  }
}

function buildShell(nav) {
  const app = nav.closest(".app");
  const header = app ? Array.from(app.children).find((child) => child.tagName === "HEADER") : null;
  if (!app || !header) return;

  const siblings = Array.from(app.children).filter((child) => child !== header);

  const shell = document.createElement("div");
  shell.className = "forti-shell";

  // ── Sidebar
  const sidebar = document.createElement("aside");
  sidebar.className = "forti-sidebar";
  sidebar.innerHTML = `
    <div class="forti-sidebar-brand">
      <div class="forti-brand-mark">FS</div>
      <div class="forti-brand-text">
        <span class="forti-brand-name">Fabric SE</span>
        <span class="forti-brand-sub">SE Toolbox</span>
      </div>
    </div>
  `;

  nav.classList.remove("top-nav");
  nav.classList.add("forti-sidebar-nav");
  sidebar.appendChild(nav);

  const sidebarFooter = document.createElement("div");
  sidebarFooter.className = "forti-sidebar-footer";
  sidebarFooter.innerHTML = `
    <button id="forti-shell-toggle" class="forti-collapse-btn" type="button" aria-expanded="true" aria-label="Collapse navigation">
      ${icon("chevLeft", 14)}
      <span class="forti-collapse-label">Collapse</span>
    </button>
  `;
  sidebar.appendChild(sidebarFooter);

  // ── Main
  const shellMain = document.createElement("div");
  shellMain.className = "forti-shell-main";

  const topbar = document.createElement("div");
  topbar.className = "forti-topbar";
  topbar.innerHTML = `
    <div class="forti-breadcrumb">
      <span class="forti-bc-root">Fabric SE</span>
      <span class="forti-bc-sep">${icon("chevRight", 12)}</span>
      <span class="forti-bc-current" id="forti-bc-current"></span>
    </div>
    <div class="forti-topbar-right" id="forti-topbar-right">
      <div id="admin-alerts" hidden></div>
      <div id="theme-toggle"></div>
    </div>
  `;

  const page = document.createElement("div");
  page.className = "forti-page";
  header.classList.add("forti-page-header");
  page.appendChild(header);
  siblings.forEach((node) => page.appendChild(node));

  shellMain.append(topbar, page);
  shell.append(sidebar, shellMain);
  app.replaceChildren(shell);
}

function wireShellInteractions() {
  const toggle = document.getElementById("forti-shell-toggle");
  const triggers = document.querySelectorAll(".forti-nav-group-trigger");

  toggle?.addEventListener("click", () => {
    const sidebar = document.querySelector(".forti-sidebar");
    setCollapsed(!sidebar?.classList.contains("forti-sidebar-rail"));
  });

  triggers.forEach((trigger) => {
    if (!(trigger instanceof HTMLButtonElement)) return;
    trigger.addEventListener("click", () => {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!expanded));
      const chevron = trigger.querySelector(".forti-nav-chevron");
      if (chevron) chevron.classList.toggle("open", !expanded);
    });
  });

  setCollapsed(preferredCollapsed());
}

export function initToolboxNav({ current, basePath = "./", navId = "toolbox-nav" }) {
  const nav = document.getElementById(navId);
  if (!nav) return;

  if (!nav.closest(".forti-shell")) {
    buildShell(nav);
  }

  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const currentKeys = normalizeCurrent(current);

  nav.innerHTML = TOOLBOX_ITEMS
    .map((item) => renderNode(item, normalizedBase, currentKeys))
    .join("");

  const bcCurrent = document.getElementById("forti-bc-current");
  if (bcCurrent) {
    bcCurrent.textContent = findActiveToolLabel(currentKeys);
  }

  wireShellInteractions();
  initAdminAlerts({ basePath: normalizedBase });
}
