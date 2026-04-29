export const APP_METADATA = {
  author: "Jeff Clark",
  version: "2026.04.4",
  lastUpdated: "2026-04-29",
  versionScheme: "CalVer: YYYY.MM.PATCH"
};

export function formatLastUpdated(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}
