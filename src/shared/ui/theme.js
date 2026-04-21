const COLOR_MODE_KEY = "fortisku-theme";
const DESIGN_THEME_KEY = "fortisku-design-theme";

const VALID_COLOR_MODES = new Set(["light", "dark"]);
const VALID_DESIGN_THEMES = new Set(["soltesz", "fortigate", "forge"]);

const PALETTE_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".8" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".8" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".8" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".8" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`;

const SUN_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>`;

const MOON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

const THEMES = [
  { value: "soltesz", label: "Standard", dot: "#bc0004" },
  { value: "forge",   label: "FabricBOM", dot: "#EE3124" },
  { value: "fortigate", label: "SE Classic", dot: "#046434" },
];

function isValidColorMode(value) { return VALID_COLOR_MODES.has(value); }
function isValidDesignTheme(value) { return VALID_DESIGN_THEMES.has(value); }

function preferredColorMode() {
  const stored = window.localStorage.getItem(COLOR_MODE_KEY);
  if (isValidColorMode(stored)) return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function preferredDesignTheme() {
  const stored = window.localStorage.getItem(DESIGN_THEME_KEY);
  if (isValidDesignTheme(stored)) return stored;
  return "soltesz";
}

function applyAppearance({ colorMode, designTheme }) {
  const normalizedColorMode = colorMode === "dark" ? "dark" : "light";
  const normalizedDesignTheme = isValidDesignTheme(designTheme) ? designTheme : "soltesz";

  document.body.classList.toggle("theme-dark", normalizedColorMode === "dark");
  document.body.dataset.designTheme = normalizedDesignTheme;
  document.documentElement.style.colorScheme = normalizedColorMode;
  document.documentElement.dataset.designTheme = normalizedDesignTheme;

  window.dispatchEvent(new CustomEvent("fortisku:appearance-change", {
    detail: { colorMode: normalizedColorMode, designTheme: normalizedDesignTheme }
  }));

  return { colorMode: normalizedColorMode, designTheme: normalizedDesignTheme };
}

function currentAppearance() {
  return {
    colorMode: document.body.classList.contains("theme-dark") ? "dark" : "light",
    designTheme: isValidDesignTheme(document.body.dataset.designTheme)
      ? document.body.dataset.designTheme
      : "soltesz"
  };
}

function saveAppearance({ colorMode, designTheme }) {
  window.localStorage.setItem(COLOR_MODE_KEY, colorMode);
  window.localStorage.setItem(DESIGN_THEME_KEY, designTheme);
}

function menuMarkup() {
  const themeItems = THEMES.map(t =>
    `<button type="button" class="forti-theme-pop-item appearance-theme-option" data-theme="${t.value}">
      <span class="forti-theme-pop-dot" style="background:${t.dot}"></span>
      ${t.label}
    </button>`
  ).join("");

  return `
    <div class="forti-theme-container">
      <button type="button" class="forti-topbar-icon-btn appearance-menu-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Theme settings">
        ${PALETTE_SVG}
      </button>
      <div class="forti-theme-pop" hidden>
        <div class="forti-theme-pop-label">Theme</div>
        ${themeItems}
        <div class="forti-theme-pop-sep"></div>
        <button type="button" class="forti-theme-pop-toggle appearance-mode-toggle">
          <span class="forti-mode-icon"></span>
          <span class="forti-mode-label">Light</span>
          <span class="forti-theme-pop-mode">OFF</span>
        </button>
      </div>
    </div>
  `;
}

function updateMenuState(root, appearance) {
  if (!root) return;

  const isDark = appearance.colorMode === "dark";

  root.querySelectorAll(".appearance-theme-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === appearance.designTheme);
  });

  const modeIcon = root.querySelector(".forti-mode-icon");
  if (modeIcon) modeIcon.innerHTML = isDark ? MOON_SVG : SUN_SVG;

  const modeLabel = root.querySelector(".forti-mode-label");
  if (modeLabel) modeLabel.textContent = isDark ? "Dark mode" : "Light mode";

  const modeState = root.querySelector(".forti-theme-pop-mode");
  if (modeState) modeState.textContent = isDark ? "ON" : "OFF";

  const paletteBtn = root.querySelector(".appearance-menu-trigger");
  if (paletteBtn) {
    const theme = THEMES.find(t => t.value === appearance.designTheme);
    paletteBtn.setAttribute("aria-label", `Theme: ${theme?.label || "Standard"}, ${isDark ? "dark" : "light"} mode`);
  }
}

function closePopover(root) {
  const pop = root?.querySelector(".forti-theme-pop");
  const trigger = root?.querySelector(".appearance-menu-trigger");
  if (!pop || !trigger) return;
  trigger.setAttribute("aria-expanded", "false");
  pop.hidden = true;
}

function openPopover(root) {
  const pop = root?.querySelector(".forti-theme-pop");
  const trigger = root?.querySelector(".appearance-menu-trigger");
  if (!pop || !trigger) return;
  trigger.setAttribute("aria-expanded", "true");
  pop.hidden = false;
}

function wireMenu(root) {
  if (!root || root.dataset.appearanceMenuWired === "true") return;

  const trigger = root.querySelector(".appearance-menu-trigger");
  const pop = root.querySelector(".forti-theme-pop");
  const modeToggle = root.querySelector(".appearance-mode-toggle");

  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    if (expanded) closePopover(root); else openPopover(root);
  });

  pop?.addEventListener("click", (e) => e.stopPropagation());

  root.querySelectorAll(".appearance-theme-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const appearance = currentAppearance();
      const next = applyAppearance({ colorMode: appearance.colorMode, designTheme: btn.dataset.theme });
      saveAppearance(next);
      updateMenuState(root, next);
      closePopover(root);
    });
  });

  const toggleDark = () => {
    const appearance = currentAppearance();
    const next = applyAppearance({ colorMode: appearance.colorMode === "dark" ? "light" : "dark", designTheme: appearance.designTheme });
    saveAppearance(next);
    updateMenuState(root, next);
  };

  modeToggle?.addEventListener("click", (e) => { e.stopPropagation(); toggleDark(); });

  document.addEventListener("pointerdown", (e) => {
    if (!(e.target instanceof Node) || !root.contains(e.target)) closePopover(root);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover(root);
  });

  root.dataset.appearanceMenuWired = "true";
}

function populateThemeToggle(appearance) {
  const slot = document.getElementById("theme-toggle");
  if (!slot || slot.dataset.appearanceMenuReady === "true") return slot;
  slot.innerHTML = menuMarkup();
  slot.dataset.appearanceMenuReady = "true";
  return slot;
}

export function getCurrentAppearance() { return currentAppearance(); }

export function initThemeToggle() {
  const applied = applyAppearance({
    colorMode: preferredColorMode(),
    designTheme: preferredDesignTheme()
  });

  const root = populateThemeToggle(applied);
  if (!root) return;

  updateMenuState(root, applied);
  wireMenu(root);
}
