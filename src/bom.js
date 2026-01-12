import { get, set } from "../vendor/idb-keyval.mjs";

const STORAGE_KEY = "fortisku-finder:bom:v1";

let items = [];
const listeners = new Set();
let initialized = false;

export async function initBOM() {
  if (initialized) {
    return getState();
  }
  const stored = await get(STORAGE_KEY);
  if (Array.isArray(stored)) {
    items = stored.map(normalizeItem);
  }
  initialized = true;
  return getState();
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

export function getState() {
  return {
    items: items.map((item) => ({ ...item })),
    totals: computeTotals(items)
  };
}

export async function addOrIncrement(rawItem, options = {}) {
  const quantity = options.quantity ?? 1;
  const hasDiscount = Object.prototype.hasOwnProperty.call(options, "discountPercent");
  const discountPercent = hasDiscount ? options.discountPercent : undefined;
  const normalized = normalizeItem({ ...rawItem, quantity, discountPercent });
  const index = items.findIndex((entry) => entry.id === normalized.id);
  if (index >= 0) {
    const existing = items[index];
    existing.quantity += normalized.quantity;
    if (hasDiscount) {
      existing.discountPercent = clampDiscount(discountPercent);
    }
    existing.updatedAt = new Date().toISOString();
    items[index] = existing;
  } else {
    items.push({
      ...normalized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  await persist();
  notify();
}

export async function updateItem(id, updates) {
  const index = items.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  const current = items[index];
  const next = {
    ...current,
    ...updates,
    quantity: clampQuantity(updates.quantity ?? current.quantity),
    discountPercent: clampDiscount(updates.discountPercent ?? current.discountPercent),
    updatedAt: new Date().toISOString()
  };
  items[index] = next;
  await persist();
  notify();
}

export async function removeItem(id) {
  const index = items.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  items.splice(index, 1);
  await persist();
  notify();
}

export async function clearBOM() {
  items = [];
  await persist();
  notify();
}

function notify() {
  const state = getState();
  listeners.forEach((listener) => listener(state));
}

async function persist() {
  await set(STORAGE_KEY, items);
}

function normalizeItem(item) {
  return {
    id: item.id,
    sku: item.sku,
    description: item.description ?? "",
    description2: item.description2 ?? "",
    price: typeof item.price === "number" ? item.price : coercePrice(item.price),
    priceDisplay: item.price_display ?? item.priceDisplay ?? "",
    category: item.category ?? "",
    comments: item.comments ?? "",
    quantity: clampQuantity(item.quantity ?? 1),
    discountPercent: clampDiscount(item.discountPercent ?? 0)
  };
}

function coercePrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clampQuantity(quantity) {
  const numeric = Number(quantity);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 1;
  }
  return Math.round(numeric);
}

function clampDiscount(discount) {
  const numeric = Number(discount);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  if (numeric > 100) {
    return 100;
  }
  return Math.round(numeric * 100) / 100;
}

function computeTotals(list) {
  const summary = {
    itemCount: list.length,
    totalQuantity: 0,
    listTotal: 0,
    discountedTotal: 0
  };

  for (const item of list) {
    const lineTotal = item.price * item.quantity;
    const discounted = lineTotal * (1 - item.discountPercent / 100);
    summary.totalQuantity += item.quantity;
    summary.listTotal += lineTotal;
    summary.discountedTotal += discounted;
  }

  return summary;
}
