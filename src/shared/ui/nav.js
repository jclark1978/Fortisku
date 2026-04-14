const TOOLBOX_LINKS = [
  { key: "finder", label: "FortiSKU Finder", href: "" },
  { key: "hardware-lifecycle", label: "Hardware LifeCycle", href: "hardware-lifecycle/" },
  { key: "ordering-guides", label: "Ordering Guides", href: "ordering-guides/" },
  { key: "asset-reports", label: "Asset Reports", href: "asset-reports/" },
  { key: "lab-portal", label: "Lab Portal Generator", href: "lab-portal/" }
];

export function initToolboxNav({ current, basePath = "./", navId = "toolbox-nav" }) {
  const nav = document.getElementById(navId);
  if (!nav) {
    return;
  }

  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  nav.innerHTML = TOOLBOX_LINKS
    .map((link) => {
      const href = link.href ? `${normalizedBase}${link.href}` : normalizedBase;
      const currentAttr = link.key === current ? ' aria-current="page"' : "";
      return `<a href="${href}"${currentAttr}>${link.label}</a>`;
    })
    .join("");
}
