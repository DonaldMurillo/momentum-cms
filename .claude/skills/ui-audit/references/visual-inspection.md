# Visual Inspection Reference

URLs, viewport sizes, and inspection procedures for browser-based auditing.

## Storybook URLs

### Base URL

```
http://localhost:4400
```

### Starting Storybook

```bash
nx storybook ui --port 4400
```

### Story URL Pattern

```
http://localhost:4400/?path=/story/<category>-<component>--<story-name>
```

**Categories:**

- `components-` - UI components
- `forms-` - Form elements (if separate)
- `layout-` - Layout components (if separate)

**Story Names:**

- PascalCase story → kebab-case URL
- `Primary` → `primary`
- `AllVariants` → `all-variants`
- `ClickInteraction` → `click-interaction`
- `WithSelection` → `with-selection`

### Common Component URLs

| Component      | URL                                      |
| -------------- | ---------------------------------------- |
| Button Primary | `/story/components-button--primary`      |
| Button All     | `/story/components-button--all-variants` |
| Card           | `/story/components-card--default`        |
| Input          | `/story/components-input--default`       |
| Checkbox       | `/story/components-checkbox--default`    |
| Select         | `/story/components-select--default`      |
| Tabs           | `/story/components-tabs--default`        |
| DataTable      | `/story/components-data-table--default`  |
| Command        | `/story/components-command--default`     |

### Docs URL Pattern

For autodocs view:

```
http://localhost:4400/?path=/docs/<category>-<component>--docs
```

## Kitchen Sink URL

```
http://localhost:4200/kitchen-sink
```

### Starting Dev Server

```bash
nx serve example-angular
```

### Section Anchors

Navigate to specific sections:

```
http://localhost:4200/kitchen-sink#buttons
http://localhost:4200/kitchen-sink#forms
http://localhost:4200/kitchen-sink#cards
```

Or use agent-browser to scroll to section:

```bash
agent-browser find text "Buttons" scrollintoview
```

## Admin Dashboard URL

```
http://localhost:4200/admin
http://localhost:4200/admin/dashboard
```

### Admin Pages

| Page            | URL                             |
| --------------- | ------------------------------- |
| Dashboard       | `/admin/dashboard`              |
| Collection List | `/admin/<collection-slug>`      |
| Create Entity   | `/admin/<collection-slug>/new`  |
| Edit Entity     | `/admin/<collection-slug>/<id>` |

## Viewport Sizes

### Mobile-First Breakpoints

| Name       | Width | Height | Device           |
| ---------- | ----- | ------ | ---------------- |
| mobile-sm  | 320   | 568    | iPhone SE        |
| mobile     | 375   | 812    | iPhone X/12/13   |
| mobile-lg  | 414   | 896    | iPhone Plus/Max  |
| tablet     | 768   | 1024   | iPad             |
| laptop     | 1024  | 768    | Small laptop     |
| desktop    | 1280  | 800    | Standard desktop |
| desktop-lg | 1920  | 1080   | Full HD          |

### Setting Viewport with agent-browser

```bash
# Mobile
agent-browser set viewport 375 812

# Tablet
agent-browser set viewport 768 1024

# Desktop
agent-browser set viewport 1280 800
```

### Tailwind Breakpoint Reference

| Breakpoint | Min Width | CSS                          |
| ---------- | --------- | ---------------------------- |
| sm         | 640px     | `@media (min-width: 640px)`  |
| md         | 768px     | `@media (min-width: 768px)`  |
| lg         | 1024px    | `@media (min-width: 1024px)` |
| xl         | 1280px    | `@media (min-width: 1280px)` |
| 2xl        | 1536px    | `@media (min-width: 1536px)` |

## Theme Switching

### In Storybook

Toggle theme via toolbar button:

```bash
agent-browser snapshot -i
# Find theme toggle button (usually in toolbar)
agent-browser click @e<theme-ref>
```

Or use keyboard shortcut if configured.

### In Application

Use McmsThemeService toggle:

```bash
# Find theme toggle in sidebar footer
agent-browser find text "theme" click
# Or find the moon/sun icon button
agent-browser find role button click --name "Toggle theme"
```

### Verifying Dark Mode

```bash
# Check if dark class is applied
agent-browser eval "document.documentElement.classList.contains('dark')"
```

## Screenshot Workflow

### Basic Screenshot

```bash
agent-browser open "http://localhost:4400/?path=/story/components-button--primary"
agent-browser wait --load networkidle
agent-browser screenshot ./audit/button-primary.png
```

### Full Page Screenshot

```bash
agent-browser screenshot --full ./audit/page-full.png
```

### Element Screenshot

```bash
agent-browser snapshot -i
agent-browser screenshot @e<element-ref> ./audit/element.png
```

### Theme Comparison

```bash
# Light mode
agent-browser open "http://localhost:4400/?path=/story/components-button--primary"
agent-browser wait --load networkidle
agent-browser screenshot ./audit/button-light.png

# Dark mode
agent-browser click @e<theme-toggle>
agent-browser wait 500
agent-browser screenshot ./audit/button-dark.png
```

### Responsive Comparison

```bash
URL="http://localhost:4200/kitchen-sink"

agent-browser open "$URL"
agent-browser wait --load networkidle

# Mobile
agent-browser set viewport 375 812
agent-browser wait 500
agent-browser screenshot ./audit/mobile.png

# Tablet
agent-browser set viewport 768 1024
agent-browser wait 500
agent-browser screenshot ./audit/tablet.png

# Desktop
agent-browser set viewport 1280 800
agent-browser wait 500
agent-browser screenshot ./audit/desktop.png
```

## Interaction Testing

### Click and Verify

```bash
agent-browser snapshot -i
agent-browser click @e<button-ref>
agent-browser wait 500
agent-browser screenshot ./audit/after-click.png
```

### Form Interaction

```bash
agent-browser snapshot -i
agent-browser fill @e<input-ref> "test@example.com"
agent-browser click @e<submit-ref>
agent-browser wait --load networkidle
agent-browser screenshot ./audit/form-submitted.png
```

### Dropdown/Select

```bash
agent-browser snapshot -i
agent-browser click @e<trigger-ref>
agent-browser wait 300
agent-browser snapshot -i  # Re-snapshot for dropdown options
agent-browser screenshot ./audit/dropdown-open.png
agent-browser click @e<option-ref>
agent-browser screenshot ./audit/dropdown-selected.png
```

### Tab Navigation

```bash
agent-browser snapshot -i
agent-browser click @e<tab2-ref>
agent-browser wait 300
agent-browser screenshot ./audit/tab2-active.png
```

## Session Management

### Named Sessions

```bash
# Use named session for audit
agent-browser --session ui-audit open "http://localhost:4400"

# All subsequent commands use same session
agent-browser --session ui-audit snapshot -i
agent-browser --session ui-audit screenshot ./audit/shot.png

# Close session when done
agent-browser --session ui-audit close
```

### Save/Restore State

```bash
# After login
agent-browser state save ./audit-session.json

# Later, restore
agent-browser state load ./audit-session.json
agent-browser open "http://localhost:4200/admin/dashboard"
```

## Output Directory Structure

Recommended structure for audit screenshots:

```
audit/
├── <component>/
│   ├── storybook/
│   │   ├── primary-light.png
│   │   ├── primary-dark.png
│   │   ├── secondary-light.png
│   │   ├── secondary-dark.png
│   │   └── interaction.png
│   ├── kitchen-sink/
│   │   ├── desktop.png
│   │   ├── tablet.png
│   │   └── mobile.png
│   └── responsive/
│       ├── 320.png
│       ├── 375.png
│       ├── 768.png
│       ├── 1024.png
│       └── 1280.png
└── report.md
```
