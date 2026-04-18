import { groupCatalogByCategory } from "../../features/bom-builder/catalog.js";

const SHELL_COLLAPSED_KEY = "fortisku-shell-collapsed";

function categoryKey(category) {
  return `bom-category-${String(category).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const TOOLBOX_ITEMS = [
  { key: "finder", label: "FortiSKU Finder", href: "" },
  {
    key: "bom-builder",
    label: "BOM Builder",
    children: groupCatalogByCategory().map(({ category, products }) => ({
      key: categoryKey(category),
      label: category,
      children: products.map((product) => ({
        key: `bom-product-${product.slug}`,
        label: product.label,
        href: `bom-builder/?product=${encodeURIComponent(product.slug)}`
      }))
    }))
  },
  {
    key: "lifecycle",
    label: "LifeCycle",
    children: [
      { key: "hardware-lifecycle", label: "Hardware LifeCycle", href: "hardware-lifecycle/" },
      { key: "software-lifecycle", label: "Software LifeCycle", href: "software-lifecycle/" }
    ]
  },
  { key: "ordering-guides", label: "Ordering Guides", href: "ordering-guides/" },
  { key: "asset-reports", label: "Asset Reports", href: "asset-reports/" },
  { key: "lab-portal", label: "Lab Portal Generator", href: "lab-portal/" }
];

function normalizeCurrent(current) {
  if (Array.isArray(current)) {
    return new Set(current.filter(Boolean));
  }
  return new Set(current ? [current] : []);
}

function nodeHasCurrent(node, currentKeys) {
  if (currentKeys.has(node.key)) {
    return true;
  }
  return Array.isArray(node.children) && node.children.some((child) => nodeHasCurrent(child, currentKeys));
}

function renderNode(node, normalizedBase, currentKeys, depth = 0) {
  if (node.children?.length) {
    return renderGroup(node, normalizedBase, currentKeys, depth);
  }
  return renderLink(node, normalizedBase, currentKeys, depth);
}

function renderLink(link, normalizedBase, currentKeys, depth) {
  const href = link.href ? `${normalizedBase}${link.href}` : normalizedBase;
  const currentAttr = currentKeys.has(link.key) ? ' aria-current="page"' : "";
  return `<a class="forti-nav-link" data-depth="${depth}" href="${href}"${currentAttr}>${link.label}</a>`;
}

function renderGroup(item, normalizedBase, currentKeys, depth) {
  const isCurrent = item.children.some((link) => nodeHasCurrent(link, currentKeys));
  const expandedAttr = isCurrent ? "true" : "false";
  const currentAttr = isCurrent ? ' data-current="true"' : "";
  const children = item.children
    .map((child) => renderNode(child, normalizedBase, currentKeys, depth + 1))
    .join("");

  return `
    <div class="forti-nav-group" data-depth="${depth}"${currentAttr}>
      <button class="forti-nav-group-trigger" data-depth="${depth}" type="button" aria-expanded="${expandedAttr}">
        <span>${item.label}</span>
      </button>
      <div class="forti-nav-group-menu" data-depth="${depth + 1}">
        ${children}
      </div>
    </div>
  `;
}

function preferredCollapsed() {
  return window.localStorage.getItem(SHELL_COLLAPSED_KEY) === "true";
}

function setCollapsed(collapsed) {
  document.body.classList.toggle("forti-shell-collapsed", collapsed);
  window.localStorage.setItem(SHELL_COLLAPSED_KEY, collapsed ? "true" : "false");
  const toggle = document.getElementById("forti-shell-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand navigation menu" : "Collapse navigation menu");
  }
}

function buildShell(nav) {
  const app = nav.closest(".app");
  const header = app ? Array.from(app.children).find((child) => child.tagName === "HEADER") : null;
  if (!app || !header) {
    return;
  }

  const siblings = Array.from(app.children).filter((child) => child !== header);
  const themeToggle = header.querySelector("#theme-toggle");

  const shell = document.createElement("div");
  shell.className = "forti-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "forti-sidebar";
  sidebar.innerHTML = `
    <div class="forti-sidebar-brand">
      <span class="forti-sidebar-brand-mark" aria-hidden="true">■</span>
      <span class="forti-sidebar-brand-text">FortiSKU</span>
    </div>
  `;

  nav.classList.remove("top-nav");
  nav.classList.add("forti-sidebar-nav");
  sidebar.appendChild(nav);

  const shellMain = document.createElement("div");
  shellMain.className = "forti-shell-main";

  const topbar = document.createElement("div");
  topbar.className = "forti-topbar";
  topbar.innerHTML = `
    <div class="forti-topbar-left">
      <button id="forti-shell-toggle" class="forti-topbar-icon forti-topbar-toggle" type="button" aria-expanded="true" aria-label="Collapse navigation menu">
        <span aria-hidden="true">☰</span>
      </button>
    </div>
    <div class="forti-topbar-right"></div>
  `;

  if (themeToggle) {
    topbar.querySelector(".forti-topbar-right")?.prepend(themeToggle);
  }

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
    setCollapsed(!document.body.classList.contains("forti-shell-collapsed"));
  });

  triggers.forEach((trigger) => {
    if (!(trigger instanceof HTMLButtonElement)) {
      return;
    }
    trigger.addEventListener("click", () => {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!expanded));
    });
  });

  setCollapsed(preferredCollapsed());
}

export function initToolboxNav({ current, basePath = "./", navId = "toolbox-nav" }) {
  const nav = document.getElementById(navId);
  if (!nav) {
    return;
  }

  if (!nav.closest(".forti-shell")) {
    buildShell(nav);
  }

  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const currentKeys = normalizeCurrent(current);
  nav.innerHTML = TOOLBOX_ITEMS
    .map((item) => renderNode(item, normalizedBase, currentKeys, 0))
    .join("");

  wireShellInteractions();
}

