function toHardwareMilestoneRows(row) {
  const milestones = [
    { milestone: "End of Order", date: row.endOfOrderDate },
    { milestone: "Last Service Extension", date: row.lastServiceExtensionDate },
    { milestone: "End of Support", date: row.endOfSupportDate }
  ];

  const expanded = milestones
    .filter(({ date }) => date)
    .map(({ milestone, date }) => ({
      product: row.product,
      release: "",
      milestone,
      date,
      details: row.category,
      sourceUrl: ""
    }));

  if (!expanded.length) {
    expanded.push({ product: row.product, release: "", milestone: "", date: "", details: row.category, sourceUrl: "" });
  }

  return expanded;
}

function toSoftwareMilestoneRows(row) {
  const milestones = [
    { milestone: "Release", date: row.releaseDate },
    { milestone: "End of Engineering Support", date: row.endOfEngineeringSupportDate },
    { milestone: "End of Support", date: row.endOfSupportDate }
  ];

  const expanded = milestones
    .filter(({ date }) => date)
    .map(({ milestone, date }) => ({
      product: row.product,
      release: row.releaseDate,
      milestone,
      date,
      details: "",
      sourceUrl: ""
    }));

  if (!expanded.length) {
    expanded.push({ product: row.product, release: row.releaseDate, milestone: "", date: "", details: "", sourceUrl: "" });
  }

  return expanded;
}

export function buildHardwareLifecycleDataset(rows, meta) {
  const sharedRows = rows.flatMap(toHardwareMilestoneRows);
  return {
    key: "hardware_lifecycle",
    version: 1,
    source: {
      app: "FortiSKU",
      format: "rss",
      label: meta.feedSourceTitle ?? meta.feedTitle ?? null,
      importedAt: meta.updatedAt,
      effectiveDate: meta.feedUpdatedAt ?? null
    },
    data: { rows: sharedRows },
    meta: {
      rowCount: sharedRows.length,
      schema: "toolbox_shared.hardware_lifecycle.v1"
    }
  };
}

export function buildSoftwareLifecycleDataset(rows, meta) {
  const sharedRows = rows.flatMap(toSoftwareMilestoneRows);
  return {
    key: "software_lifecycle",
    version: 1,
    source: {
      app: "FortiSKU",
      format: "rss",
      label: meta.feedSourceTitle ?? meta.feedTitle ?? null,
      importedAt: meta.updatedAt,
      effectiveDate: meta.feedUpdatedAt ?? null
    },
    data: { rows: sharedRows },
    meta: {
      rowCount: sharedRows.length,
      schema: "toolbox_shared.software_lifecycle.v1"
    }
  };
}
