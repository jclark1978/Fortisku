(function () {
  var colorModeKey = "fortisku-theme";
  var designThemeKey = "fortisku-design-theme";
  var colorMode = "light";
  var designTheme = "soltesz";

  try {
    var storedColorMode = window.localStorage.getItem(colorModeKey);
    var storedDesignTheme = window.localStorage.getItem(designThemeKey);

    if (storedColorMode === "light" || storedColorMode === "dark") {
      colorMode = storedColorMode;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      colorMode = "dark";
    }

    if (storedDesignTheme === "soltesz" || storedDesignTheme === "fortigate") {
      designTheme = storedDesignTheme;
    }
  } catch (error) {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      colorMode = "dark";
    }
  }

  document.documentElement.style.colorScheme = colorMode;
  document.documentElement.dataset.designTheme = designTheme;

  function apply() {
    if (!document.body) return false;
    document.body.classList.toggle("theme-dark", colorMode === "dark");
    document.body.dataset.designTheme = designTheme;
    return true;
  }

  if (apply()) return;

  var observer = new MutationObserver(function () {
    if (apply()) {
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
)();
