```markdown
# Design System Strategy: Tactical Precision
 
## 1. Overview & Creative North Star
This design system is engineered for high-stakes, mission-critical environments where data density is not a constraint, but a requirement. We move beyond the "dashboard-as-a-service" aesthetic to embrace **The Tactical Command Center**. 
 
The Creative North Star is defined by **Absolute Functional Clarity**. By utilizing a high-density grid and a precision-focused layout, the interface transforms complex network telemetry into an actionable editorial landscape. We reject the "fluff" of modern consumer web design—unnecessary padding and decorative shadows—in favor of a sophisticated, layered environment that prioritizes optical alignment and tonal hierarchy. This is where brutalist utility meets executive-level polish.
 
---
 
## 2. Colors & Tonal Depth
The palette is rooted in a disciplined execution of green and cool grays, providing a stable environment for long-term cognitive focus.
 
*   **Primary Anchor:** Use `primary` (#046434) for top-level global branding and `primary-container` (#2b7d4a) for active states and high-priority call-to-actions.
*   **The "No-Line" Rule:** To maintain a premium feel despite high data density, 1px solid borders for sectioning are prohibited. Boundaries are defined through background shifts. For example, the dark sidebar (`inverse-surface`) should meet the main content area (`surface`) without a stroke.
*   **Surface Hierarchy:** Use nested tiers to define focus. 
    *   **Level 0 (Base):** `surface` (#f4fafe) for the main canvas.
    *   **Level 1 (Navigation):** `inverse-surface` (#2a3134) for the sidebar to provide maximum contrast.
    *   **Level 2 (Containers):** `surface-container-low` (#eef5f8) for grouping secondary modules.
    *   **Level 3 (Interactive):** `surface-container-lowest` (#ffffff) for table rows and input fields to make them "pop" against the gray background.
*   **Signature Textures:** Main toolbars should utilize a subtle vertical gradient from `primary-container` to `primary` to provide a "machined" feel, suggesting a solid, tactile hardware interface.
 
---
 
## 3. Typography
The system employs a dual-typeface strategy to balance authority with legibility.
 
*   **Public Sans (The Authority):** Reserved for `display` and `headline` scales. It provides a clean, neutral, yet "engineered" feel for system titles and primary module headers.
*   **Inter (The Utility):** Used for all `title`, `body`, and `label` roles. Its high x-height and technical clarity make it perfect for the 12px and 13px table text required for high-density networking logs.
*   **Density Mapping:** 
    *   `title-sm` (16px) for module headers.
    *   `body-sm` (12px - 13px) for all data-heavy table entries.
    *   `label-sm` (11px, All-Caps) for table column headers to create a distinct visual break from the data rows.
 
---
 
## 4. Elevation & Depth
Elevation is conveyed through **Tonal Layering** and **Ghost Borders** rather than traditional drop shadows.
 
*   **The Layering Principle:** Depth is achieved by stacking surface tiers. A `surface-container-lowest` card sitting on a `surface-container` base provides a clear, shadowless lift.
*   **Ghost Borders:** To ensure precision in data tables without adding visual noise, use the `outline-variant` token at 20% opacity. This creates a "hairline" guide that is visible only when necessary for ocular tracking.
*   **Glassmorphism & Depth:** For temporary overlays (modals or dropdowns), utilize `surface-container-highest` with a 12px backdrop-blur. This keeps the user grounded in the network context while bringing the interaction to the foreground.
 
---
 
## 5. Components
 
### Grouped Data Tables
The centerpiece of the system. 
*   **Structure:** Header rows use `surface-dim` with `on-surface-variant` text. 
*   **Expand/Collapse:** Use a simple chevron-right icon that rotates 90 degrees.
*   **Rows:** Alternating rows (Zebra striping) is prohibited; instead, use a 1px `outline-variant` (at 10% opacity) "Ghost Border" only on the bottom of the row. Use `surface-container-lowest` for the active row on hover.
 
### Pill-Style Status Labels
*   **Geometry:** Use `roundedness-full` for all status indicators.
*   **Styling:** Low-saturation backgrounds with high-contrast text. 
    *   *Success:* `primary-fixed` background with `on-primary-fixed-variant` text.
    *   *Critical:* `error-container` background with `on-error-container` text.
*   **Sizing:** Maintain a strict height of 20px to fit within 28px table rows.
 
### Compact Action Toolbars
*   **Layout:** Icons must be 16px, paired with `label-md` text.
*   **Spacing:** Use a tight 8px gap between icon and text, and a 16px gap between action groups.
*   **Background:** Use `surface-container-high` to distinguish the toolbar from the table header below it.
 
### Input Fields
*   **Style:** Minimalist boxes with a 1px bottom-border of `outline`. On focus, the border transitions to `primary` with no glow or shadow.
*   **Typography:** All user input must use `body-sm` (Inter) for maximum character count per line.
 
---
 
## 6. Do's and Don'ts
 
### Do
*   **Do** use `surface-container` tiers to create hierarchy. If everything is white, nothing is important.
*   **Do** respect the 12px typography for logs; it is the industry standard for network engineering precision.
*   **Do** align all icons to a strict 16px or 20px bounding box to maintain the "engineered" grid.
*   **Do** use `tertiary` (#8d3a4a) for secondary warnings that are not system-critical but require attention.
 
### Don't
*   **Don't** use shadows. Professional network tools rely on color and layout for hierarchy, not artificial lighting.
*   **Don't** increase whitespace to "let the UI breathe." In this system, whitespace is wasted space. Information density is the primary goal.
*   **Don't** use rounded corners larger than `sm` (0.125rem) for functional containers (tables, inputs). Only use `full` for status pills.
*   **Don't** use high-contrast dividers. Let the background color shifts do the work of separating the sidebar from the content.```