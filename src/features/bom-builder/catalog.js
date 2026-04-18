export const PRODUCT_CATALOG = [
  { slug: "fortigate", label: "FortiGate", path: "products/fortigate-bomgen.html", category: "Network Security" },
  { slug: "fortisase", label: "FortiSASE", path: "products/fortisase-bomgen.html", category: "Network Security" },
  { slug: "fortisandbox", label: "FortiSandbox", path: "products/fortisandbox-bomgen.html", category: "Network Security" },
  { slug: "fortiadc", label: "FortiADC", path: "products/fortiadc-bomgen.html", category: "Network Security" },
  { slug: "fortideceptor", label: "FortiDeceptor", path: "products/fortideceptor-bomgen.html", category: "Network Security" },
  { slug: "fortiweb", label: "FortiWeb", path: "products/fortiweb-bomgen.html", category: "Network Security" },
  { slug: "fortiap", label: "FortiAP", path: "products/fortiap-bomgen.html", category: "Network Access" },
  { slug: "fortiswitch", label: "FortiSwitch", path: "products/fortiswitch-bomgen.html", category: "Network Access" },
  { slug: "forticlient", label: "FortiClient", path: "products/forticlient-bomgen.html", category: "Endpoint Security" },
  { slug: "fortinac", label: "FortiNAC", path: "products/fortinac-bomgen.html", category: "Access Control" },
  { slug: "fortiauthenticator", label: "FortiAuthenticator", path: "products/fortiauthenticator-bomgen.html", category: "Access Control" },
  { slug: "fortianalyzer", label: "FortiAnalyzer", path: "products/fortianalyzer-bomgen.html", category: "Management" },
  { slug: "fortimanager", label: "FortiManager", path: "products/fortimanager-bomgen.html", category: "Management" },
  { slug: "fortiaiops", label: "FortiAIOps", path: "products/fortiaiops-bomgen.html", category: "Management" },
  { slug: "fortimonitor", label: "FortiMonitor", path: "products/fortimonitor-bomgen.html", category: "Management" },
  { slug: "fortisiem", label: "FortiSIEM", path: "products/fortisiem-bomgen.html", category: "Management" },
  { slug: "fortiflex", label: "FortiFlex", path: "products/fortiflex-bomgen.html", category: "Management" },
  { slug: "custom-sku", label: "Custom SKU", path: "products/custom-sku-bomgen.html", category: "Custom" },
  { slug: "placeholder", label: "Placeholder", path: "products/placeholder-bomgen.html", category: "Demo" }
];

export function groupCatalogByCategory() {
  const groups = new Map();
  for (const product of PRODUCT_CATALOG) {
    if (!groups.has(product.category)) {
      groups.set(product.category, []);
    }
    groups.get(product.category).push(product);
  }
  return Array.from(groups.entries()).map(([category, products]) => ({ category, products }));
}

export function findProductBySlug(slug) {
  return PRODUCT_CATALOG.find((product) => product.slug === slug) || null;
}

