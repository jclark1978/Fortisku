const COLOR_MODE_KEY = "fortisku-theme";
const DESIGN_THEME_KEY = "fortisku-design-theme";

const VALID_COLOR_MODES = new Set(["light", "dark"]);
const VALID_DESIGN_THEMES = new Set(["soltesz", "fortigate"]);

function isValidColorMode(value) {
  return VALID_COLOR_MODES.has(value);
}

function isValidDesignTheme(value) {
  return VALID_DESIGN_THEMES.has(value);
}

function preferredColorMode() {
  const stored = window.localStorage.getItem(COLOR_MODE_KEY);
  if (isValidColorMode(stored)) {
    return stored;
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function preferredDesignTheme() {
  const stored = window.localStorage.getItem(DESIGN_THEME_KEY);
  if (isValidDesignTheme(stored)) {
    return stored;
  }
  return "soltesz";
}

function applyAppearance({ colorMode, designTheme }) {
  const normalizedColorMode = colorMode === "dark" ? "dark" : "light";
  const normalizedDesignTheme = designTheme === "fortigate" ? "fortigate" : "soltesz";

  document.body.classList.toggle("theme-dark", normalizedColorMode === "dark");
  document.body.dataset.designTheme = normalizedDesignTheme;
  document.documentElement.style.colorScheme = normalizedColorMode;
  document.documentElement.dataset.designTheme = normalizedDesignTheme;

  window.dispatchEvent(new CustomEvent("fortisku:appearance-change", {
    detail: {
      colorMode: normalizedColorMode,
      designTheme: normalizedDesignTheme
    }
  }));

  return {
    colorMode: normalizedColorMode,
    designTheme: normalizedDesignTheme
  };
}

function currentAppearance() {
  return {
    colorMode: document.body.classList.contains("theme-dark") ? "dark" : "light",
    designTheme: document.body.dataset.designTheme === "fortigate" ? "fortigate" : "soltesz"
  };
}

function saveAppearance({ colorMode, designTheme }) {
  window.localStorage.setItem(COLOR_MODE_KEY, colorMode);
  window.localStorage.setItem(DESIGN_THEME_KEY, designTheme);
}

function menuMarkup() {
  return `
    <button type="button" class="appearance-menu-trigger" aria-haspopup="menu" aria-expanded="false">
      <span class="appearance-trigger-icon" aria-hidden="true">◐</span>
      <span class="sr-only">Appearance</span>
    </button>
    <div class="appearance-menu-panel" hidden>
      <div class="appearance-menu-section">
        <label class="appearance-menu-heading" for="appearance-theme-select">Theme</label>
        <select id="appearance-theme-select" class="appearance-theme-select" aria-label="Choose design theme">
          <option value="soltesz">Soltesz</option>
          <option value="fortigate">FortiGate</option>
        </select>
      </div>
      <div class="appearance-menu-section">
        <span class="appearance-menu-heading">Mode</span>
        <button type="button" class="appearance-mode-toggle" aria-label="Switch color mode" aria-pressed="false">
          <span class="theme-toggle-track" aria-hidden="true">
            <span class="theme-icon theme-icon-sun">☀</span>
            <span class="theme-icon theme-icon-moon">☾</span>
            <span class="theme-toggle-knob"></span>
          </span>
          <span class="appearance-mode-label">Light</span>
        </button>
      </div>
    </div>
  `;
}

function closeMenu(root) {
  const panel = root?.querySelector(".appearance-menu-panel");
  const trigger = root?.querySelector(".appearance-menu-trigger");
  if (!root || !panel || !trigger) return;
  trigger.setAttribute("aria-expanded", "false");
  panel.hidden = true;
}

function openMenu(root) {
  const panel = root?.querySelector(".appearance-menu-panel");
  const trigger = root?.querySelector(".appearance-menu-trigger");
  if (!root || !panel || !trigger) return;
  trigger.setAttribute("aria-expanded", "true");
  panel.hidden = false;
}

function updateMenuButton(root, appearance) {
  if (!root) return;

  const trigger = root.querySelector(".appearance-menu-trigger");
  const select = root.querySelector(".appearance-theme-select");
  const modeToggle = root.querySelector(".appearance-mode-toggle");
  const modeLabel = root.querySelector(".appearance-mode-label");

  trigger?.setAttribute(
    "aria-label",
    `Appearance menu. Theme ${appearance.designTheme === "fortigate" ? "FortiGate" : "Soltesz"}, ${appearance.colorMode} mode`
  );

  if (select instanceof HTMLSelectElement) {
    select.value = appearance.designTheme;
  }

  if (modeToggle instanceof HTMLButtonElement) {
    const isDark = appearance.colorMode === "dark";
    modeToggle.setAttribute("aria-pressed", String(isDark));
    modeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  }

  if (modeLabel) {
    modeLabel.textContent = appearance.colorMode === "dark" ? "Dark" : "Light";
  }
}

function upgradeButton(button) {
  if (!button || button.dataset.appearanceMenuReady === "true") {
    return button;
  }

  const root = document.createElement("div");
  root.id = button.id;
  root.className = `${button.className} appearance-menu`;
  root.innerHTML = menuMarkup();
  root.dataset.appearanceMenuReady = "true";
  button.replaceWith(root);
  return root;
}

function wireMenu(root) {
  if (!root || root.dataset.appearanceMenuWired === "true") {
    return;
  }

  const trigger = root.querySelector(".appearance-menu-trigger");
  const panel = root.querySelector(".appearance-menu-panel");
  const select = root.querySelector(".appearance-theme-select");
  const modeToggle = root.querySelector(".appearance-mode-toggle");

  trigger?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    if (expanded) {
      closeMenu(root);
    } else {
      openMenu(root);
    }
  });

  panel?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  select?.addEventListener("change", () => {
    const appearance = currentAppearance();
    const nextAppearance = {
      colorMode: appearance.colorMode,
      designTheme: select.value
    };
    const applied = applyAppearance(nextAppearance);
    saveAppearance(applied);
    updateMenuButton(root, applied);
    closeMenu(root);
  });

  modeToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const appearance = currentAppearance();
    const nextAppearance = {
      colorMode: appearance.colorMode === "dark" ? "light" : "dark",
      designTheme: appearance.designTheme
    };
    const applied = applyAppearance(nextAppearance);
    saveAppearance(applied);
    updateMenuButton(root, applied);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Node) || !root.contains(event.target)) {
      closeMenu(root);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu(root);
    }
  });

  root.dataset.appearanceMenuWired = "true";
}

export function getCurrentAppearance() {
  return currentAppearance();
}

export function initThemeToggle(buttonId = "theme-toggle") {
  const root = upgradeButton(document.getElementById(buttonId));
  const applied = applyAppearance({
    colorMode: preferredColorMode(),
    designTheme: preferredDesignTheme()
  });
  updateMenuButton(root, applied);

  if (!root) {
    return;
  }

  wireMenu(root);
}
