import { get, set, del } from "../vendor/idb-keyval.mjs";

export const SCHEMA_VERSION = "3";

const KEY_PREFIX = "fortisku-finder";
const KEY_ROWS = `${KEY_PREFIX}:rows:v${SCHEMA_VERSION}`;
const KEY_INDEX = `${KEY_PREFIX}:index:v${SCHEMA_VERSION}`;
const KEY_META = `${KEY_PREFIX}:meta:v${SCHEMA_VERSION}`;

export async function loadPersisted() {
  const meta = await get(KEY_META);
  if (!meta || meta.schemaVersion !== SCHEMA_VERSION) {
    await clearPersisted();
    return null;
  }

  const rows = await get(KEY_ROWS);
  const indexJSON = await get(KEY_INDEX);

  if (!rows || !indexJSON) {
    await clearPersisted();
    return null;
  }

  return {
    rows,
    indexJSON,
    meta
  };
}

export async function savePersisted(rows, indexJSON, meta) {
  const payload = {
    ...meta,
    schemaVersion: SCHEMA_VERSION
  };

  await Promise.all([
    set(KEY_ROWS, rows),
    set(KEY_INDEX, indexJSON),
    set(KEY_META, payload)
  ]);

  return payload;
}

export async function clearPersisted() {
  await Promise.all([del(KEY_ROWS), del(KEY_INDEX), del(KEY_META)]);
}

export function estimateSizeBytes(rows, indexJSON) {
  const rowsBytes = new TextEncoder().encode(JSON.stringify(rows)).length;
  const indexBytes = new TextEncoder().encode(JSON.stringify(indexJSON)).length;
  return rowsBytes + indexBytes;
}
