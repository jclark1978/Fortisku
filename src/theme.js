const STORAGE_KEY = "fortisku-theme";

function isValidTheme(value) {
  return value === "light" || value === "dark";
}

function preferredTheme() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isValidTheme(stored)) {
    return stored;
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("theme-dark", normalized === "dark");
  document.documentElement.style.colorScheme = normalized;
  return normalized;
}

function updateToggleButton(button, activeTheme) {
  if (!button) return;
  const nextTheme = activeTheme === "dark" ? "light" : "dark";
  button.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  button.setAttribute("aria-pressed", String(activeTheme === "dark"));
}

export function initThemeToggle(buttonId = "theme-toggle") {
  const button = document.getElementById(buttonId);
  let theme = applyTheme(preferredTheme());
  updateToggleButton(button, theme);

  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    theme = applyTheme(theme === "dark" ? "light" : "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
    updateToggleButton(button, theme);
  });
}
