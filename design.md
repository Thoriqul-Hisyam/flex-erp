# UVentra Design System Specification (`design.md`)

## Executive Summary
This document specifies the exact visual design system, color palette tokens, typography rules, component blueprints, and UI/UX guidelines extracted from the **UVentra Dashboard** design. 

All enterprise modules in the ERP Platform must strictly follow these design tokens for 100% visual consistency.

---

## 1. Core Visual Aesthetics & Principles

- **Luminous Modern SaaS Aesthetic**: Ultra-clean, spacious layout featuring soft rounded card containers (`24px` to `32px` border radius), subtle drop shadows, and soft pastel backgrounds.
- **Floating Controls**: Floating pill tabs for brand badges, active window tabs, user profile drawers, navigation toolbars, and theme switchers.
- **Data First & High Clarity**: Crisp contrast hierarchy with muted grey supporting text (`#8a94a6`), bold navy titles (`#0f172a`), and monospaced tabular numbers for financial values and SKU codes.
- **Dual Light / Dark Mode**: Seamless theme switching with high-contrast color token mapping.

---

## 2. Color Palette & Token Matrix

### 2.1 Canvas & Container Colors

| Token Name | Light Mode (Default) | Dark Mode | Usage Description |
| :--- | :--- | :--- | :--- |
| `background` | `#eceff4` | `#090c10` | Outer page canvas background |
| `card-bg` | `#ffffff` | `#12161f` | Main card containers (`rounded-3xl` / `rounded-[24px]`) |
| `item-bg` | `#f8f9fc` | `#1e293b` | Inner list rows, search toolbars, and input fields |
| `border-color`| `#e6e9f0` | `#1e293b` | Card borders and divider rules |
| `divider-color`| `#f0f2f7` | `#1e293b` | Inner table row horizontal dividers |

---

### 2.2 Brand & Accent Palette

```
  [ Electric Blue ]      [ Success Green ]      [ Warning Amber ]      [ Alert Red ]
      #0088ff                #10b981                #f59e0b               #ef4444
   (Primary Active)       (Positive Trend)       (Reorder Alert)        (Out of Stock)
```

| Color Name | Hex Code | Light Tint Background | Usage Scope |
| :--- | :--- | :--- | :--- |
| **Electric Sky Blue** | `#0088ff` | `#f0f7ff` | Active nav icons, primary buttons, logo circle, search focus |
| **Success Emerald** | `#10b981` | `#e6f9f0` | Positive growth trends (`+35%`), active status badges, expiring alerts |
| **Warning Amber** | `#f59e0b` | `#fffbea` | Stock-in chart indicator, low stock warnings, shipment received |
| **Alert Red** | `#ef4444` | `#ffeef0` | Negative trends (`-50%`), out of stock alerts, notification dots |
| **Purple Accent** | `#8a2be2` | `#f0e6ff` | Total stock value KPI icon circle, stock-out chart indicator |
| **Cyan Accent** | `#00b4d8` | `#e6fcff` | Low stock KPI icon circle, sales goal gauge gradient |
| **Text Primary** | `#0f172a` | N/A | Headings, card titles, key metric numbers |
| **Text Muted** | `#8a94a6` | N/A | Labels, subtitles, timestamps, product IDs |

---

## 3. Typography & Numerical Formatting

- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Tabular Monospace Class (`.font-mono-num`)**: Applied to all currency amounts, percentage variances, stock counts, SKU IDs, and timestamps.

```css
.font-mono-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
```

---

## 4. Component Design Specifications

### 4.1 Header Bar (`Header`)
- **Logo Pill Container**: White `#ffffff` rounded-full badge featuring cyan/blue circle `#0088ff` with white "μ" logo and title `UVentra` / `NEXUS ERP`.
- **Active Window Tab Pill**: White `#ffffff` rounded-full pill with close icon (`Dashboard Overview X`).
- **Right Utility Group**:
  - Quick Search (`Cmd+K`): White rounded-full button with `#8a94a6` search icon.
  - Settings Gear & Notification Bell: White rounded-full buttons with `#8a94a6` icons and `#ef4444` red alert dot.
  - User Profile Pill: Avatar image + "Good Morning David Warner" text + chevron down.

---

### 4.2 Floating Icon Sidebar (`Sidebar`)
- **Top Sun/Moon Theme Switcher**: Dark charcoal `#1e1e1e` pill container with `#2d2d2d` active sun circle button.
- **Main Floating Navigation Card**: Pure white `#ffffff` container (`rounded-[26px]`) with soft border `#e6e9f0`.
- **Active Navigation Icon**: Electric Sky Blue `#0088ff` circle with white icon and soft glow (`shadow-blue-500/25`).
- **Inactive Navigation Icons**: Muted grey `#8a94a6` stroke.

---

### 4.3 KPI Summary Cards
- **Container**: White `#ffffff` card with `rounded-3xl` corners and soft shadow.
- **Icon Circles (Top Right)**:
  - Total Products: Sky Blue gradient (`#00b4d8` &rarr; `#0096c7`).
  - Total Stock Value: Purple gradient (`#8a2be2` &rarr; `#7000ff`).
  - Low Stock Items: Cyan gradient (`#00c4cc` &rarr; `#00b4d8`).
- **Trend Badges**: Green `#10b981` pill (`#e6f9f0` bg) for growth; Red `#ef4444` pill (`#ffeef0` bg) for decrease.

---

### 4.4 Inventory Statistics Bar Chart
- **Indicator Legend**: Yellow dot (`Stock in`), Purple dot (`Stock Out`), Blue dot (`Stock Value`).
- **Active Highlighted Bar (Jun)**: Blue `#0088ff` column with subtle diagonal stripe texture overlay and floating white tooltip (`Stock value $37,534`).
- **Y-Axis Grid Lines**: Faint dashed lines `#f0f2f5`.

---

### 4.5 Sales Overview Gauge Meter
- **Radial Arc**: Gradient arc from `#00d2ff` to `#0077ff` with segmented dashes.
- **Centered Metrics**: Large bold `71.3%` font-extrabold with label `Sales Goal`.

---

### 4.6 Bottom Widget Columns
1. **Recent Activities**: `#f8f9fc` list items with colored circular icons (purple, amber, blue, green).
2. **Alerts & Notifications**: Soft tinted background pills (`#ffefef` red, `#eefbf4` green, `#fffbea` yellow, `#f0f7ff` blue) with right chevrons (`>`).
3. **Top Product Recommendation**: `#f8f9fc` list items with white product image thumbnails, bold titles, monospaced IDs, prices, and order counts.

---

### 4.7 Master Data Tables (`DataTable`)
- **Outer Wrapper**: White `#ffffff` container (`rounded-[24px]`) with border `#e6e9f0` and shadow `shadow-[0_4px_20px_rgba(0,0,0,0.03)]`.
- **Toolbar & Filter Pills**: Rounded-full search input (`#f8f9fc` bg) + rounded-full *Filters* & *Export* action buttons.
- **Header**: `#f8f9fc` background with uppercase text in `#8a94a6`.
- **Rows**: `#ffffff` background with hover `#f8f9fc` and divider `#f0f2f7`.
- **Pagination**: Rounded-full circular buttons (`ChevronsLeft`, `ChevronLeft`, `ChevronRight`, `ChevronsRight`).

---

### 4.8 Authentication Console (`/login`)
- **Background**: Soft cool grey `#eceff4`.
- **Central Card**: Pure white `#ffffff` container (`rounded-[32px]`) with drop shadow `shadow-[0_10px_40px_rgba(0,0,0,0.06)]` and border `#e6e9f0`.
- **Input Fields**: Rounded-full pill inputs (`rounded-full`) with `#f8f9fc` background, `#e6e9f0` border, and `#8a94a6` icon accents.
- **Primary Submit Button**: Electric Sky Blue `#0088ff` rounded-full pill button with white text and shadow `shadow-blue-500/25`.
