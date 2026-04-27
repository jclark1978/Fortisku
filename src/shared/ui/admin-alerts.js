import { loadPersisted as loadSkuPersisted } from "../data/storage.js";
import { loadLifecycleRssPersisted as loadHardwarePersisted } from "../../features/hardware-lifecycle/storage.js";
import { loadSoftwareLifecyclePersisted as loadSoftwarePersisted } from "../../features/software-lifecycle/storage.js";

const ALERTS_EVENT = "fortisku:requirements-changed";

const BELL_ICON = `
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/>
    <path d="M9 17a3 3 0 0 0 6 0"/>
  </svg>
`;

const REQUIRED_DATASETS = [
  {
    key: "sku",
    title: "Price List Required",
    description: "Upload a price sheet on the main SE Toolbox page so SKU search and dependent tools can work properly.",
    href: "",
    loadPersisted: loadSkuPersisted
  },
  {
    key: "hardware-lifecycle",
    title: "Hardware LifeCycle Feed Required",
    description: "Refresh the Hardware LifeCycle RSS feed so lifecycle lookups have local data to search.",
    href: "hardware-lifecycle/",
    loadPersisted: loadHardwarePersisted
  },
  {
    key: "software-lifecycle",
    title: "Software LifeCycle Feed Required",
    description: "Refresh the Software LifeCycle RSS feed so lifecycle lookups have local data to search.",
    href: "software-lifecycle/",
    loadPersisted: loadSoftwarePersisted
  }
];

function normalizeBasePath(basePath) {
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
}

function buildHref(basePath, href) {
  return `${normalizeBasePath(basePath)}${href}`;
}

async function collectMissingDatasets() {
  const datasets = await Promise.all(
    REQUIRED_DATASETS.map(async (dataset) => {
      try {
        const persisted = await dataset.loadPersisted();
        return persisted ? null : dataset;
      } catch (error) {
        console.warn(`Failed to inspect persisted dataset: ${dataset.key}`, error);
        return dataset;
      }
    })
  );

  return datasets.filter(Boolean);
}

function markup(basePath, missingDatasets) {
  const count = missingDatasets.length;
  const items = missingDatasets
    .map(
      (dataset) => `
        <a class="forti-alert-item" href="${buildHref(basePath, dataset.href)}">
          <span class="forti-alert-item-title">${dataset.title}</span>
          <span class="forti-alert-item-body">${dataset.description}</span>
          <span class="forti-alert-item-link">Open ${dataset.title.replace(" Required", "")}</span>
        </a>
      `
    )
    .join("");

  return `
    <div class="forti-alerts-container">
      <button
        type="button"
        class="forti-topbar-icon-btn forti-alerts-trigger"
        aria-haspopup="menu"
        aria-expanded="false"
        aria-label="${count} required dataset alert${count === 1 ? "" : "s"}"
      >
        ${BELL_ICON}
        <span class="forti-alerts-badge" aria-hidden="true">${count}</span>
      </button>
      <div class="forti-alerts-pop" hidden>
        <div class="forti-alerts-pop-label">Action Required</div>
        <p class="forti-alerts-pop-copy">
          Populate the missing local datasets below so the affected toolbox features can function correctly.
        </p>
        <div class="forti-alerts-list">
          ${items}
        </div>
      </div>
    </div>
  `;
}

function closePopover(root) {
  const trigger = root?.querySelector(".forti-alerts-trigger");
  const pop = root?.querySelector(".forti-alerts-pop");
  if (!trigger || !pop) return;
  trigger.setAttribute("aria-expanded", "false");
  pop.hidden = true;
}

function openPopover(root) {
  const trigger = root?.querySelector(".forti-alerts-trigger");
  const pop = root?.querySelector(".forti-alerts-pop");
  if (!trigger || !pop) return;
  trigger.setAttribute("aria-expanded", "true");
  pop.hidden = false;
}

function wirePopover(root) {
  if (!root || root.dataset.adminAlertsWired === "true") return;

  root.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest(".forti-alerts-trigger") : null;
    const item = event.target instanceof Element ? event.target.closest(".forti-alert-item") : null;

    if (trigger) {
      event.stopPropagation();
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      if (expanded) closePopover(root);
      else openPopover(root);
      return;
    }

    if (item) {
      closePopover(root);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Node) || !root.contains(event.target)) {
      closePopover(root);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopover(root);
    }
  });

  root.dataset.adminAlertsWired = "true";
}

export function notifyAdminRequirementsChanged() {
  window.dispatchEvent(new CustomEvent(ALERTS_EVENT));
}

export function initAdminAlerts({ basePath = "./", slotId = "admin-alerts" } = {}) {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  const normalizedBase = normalizeBasePath(basePath);
  let refreshToken = 0;

  wirePopover(slot);

  async function refresh() {
    const token = ++refreshToken;
    const missingDatasets = await collectMissingDatasets();
    if (token !== refreshToken) return;

    if (!missingDatasets.length) {
      slot.innerHTML = "";
      slot.hidden = true;
      return;
    }

    slot.hidden = false;
    slot.innerHTML = markup(normalizedBase, missingDatasets);
  }

  window.addEventListener(ALERTS_EVENT, refresh);
  refresh();
}
