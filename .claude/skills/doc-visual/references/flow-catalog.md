# Flow Catalog

Complete catalog of every documentable flow in Momentum CMS. Each entry includes the URL, capture steps, and expected output filenames.

**Related**: [SKILL.md](../SKILL.md) for quick start, [capture-conventions.md](capture-conventions.md) for naming rules.

## Contents

- [Authentication](#authentication)
- [Dashboard](#dashboard)
- [Collections CRUD](#collections-crud)
- [Field Types](#field-types)
- [Media Library](#media-library)
- [Navigation & Chrome](#navigation--chrome)
- [Plugins](#plugins)
- [Theme Comparison](#theme-comparison)
- [Responsive](#responsive)
- [Kitchen Sink](#kitchen-sink)
- [Public Site](#public-site)
- [Storybook](#storybook)

---

## Authentication

### Login Page

| Property   | Value                                                   |
| ---------- | ------------------------------------------------------- |
| URL        | `http://localhost:4200/admin/login`                     |
| Output Dir | `docs/visuals/auth/`                                    |
| Filenames  | `login-light.png`, `login-dark.png`, `login-mobile.png` |

```bash
agent-browser open "http://localhost:4200/admin/login"
agent-browser wait --load networkidle
agent-browser set viewport 1280 800
agent-browser screenshot docs/visuals/auth/login-light.png
```

### Login Flow (Video)

| Property   | Value                               |
| ---------- | ----------------------------------- |
| URL        | `http://localhost:4200/admin/login` |
| Output Dir | `docs/visuals/auth/`                |
| Filename   | `login-flow.webm`                   |

```bash
agent-browser record start docs/visuals/auth/login-flow.webm
agent-browser open "http://localhost:4200/admin/login"
agent-browser wait --load networkidle
agent-browser wait 1000
agent-browser snapshot -i
agent-browser fill @e1 "admin@test.com"
agent-browser wait 500
agent-browser fill @e2 "TestPassword123!"
agent-browser wait 500
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser wait 1500
agent-browser record stop
```

### First-Time Setup

| Property   | Value                               |
| ---------- | ----------------------------------- |
| URL        | `http://localhost:4200/admin/setup` |
| Output Dir | `docs/visuals/auth/`                |
| Filenames  | `setup-light.png`, `setup-dark.png` |

Note: Only accessible when no admin user exists. May require a fresh database.

### Forgot Password

| Property   | Value                                                   |
| ---------- | ------------------------------------------------------- |
| URL        | `http://localhost:4200/admin/forgot-password`           |
| Output Dir | `docs/visuals/auth/`                                    |
| Filenames  | `forgot-password-light.png`, `forgot-password-dark.png` |

### Reset Password

| Property   | Value                                                 |
| ---------- | ----------------------------------------------------- |
| URL        | `http://localhost:4200/admin/reset-password`          |
| Output Dir | `docs/visuals/auth/`                                  |
| Filenames  | `reset-password-light.png`, `reset-password-dark.png` |

Note: Requires a valid reset token. Capture the form layout without a valid token (shows the form structure).

---

## Dashboard

### Dashboard Overview

| Property   | Value                                       |
| ---------- | ------------------------------------------- |
| URL        | `http://localhost:4200/admin`               |
| Output Dir | `docs/visuals/dashboard/`                   |
| Filenames  | `dashboard-light.png`, `dashboard-dark.png` |

```bash
agent-browser state load docs/visuals/.auth-state.json
agent-browser open "http://localhost:4200/admin"
agent-browser wait --load networkidle
agent-browser set viewport 1280 800
agent-browser screenshot docs/visuals/dashboard/dashboard-light.png
```

### Dashboard Responsive

| Property  | Value                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------- |
| Filenames | `dashboard-mobile.png`, `dashboard-tablet.png`, `dashboard-desktop.png`, `dashboard-desktop-lg.png` |

---

## Collections CRUD

Use one of the example collections. `articles` is a good default with rich text, relationships, and standard fields.

### Collection List

| Property   | Value                                              |
| ---------- | -------------------------------------------------- |
| URL        | `http://localhost:4200/admin/collections/articles` |
| Output Dir | `docs/visuals/collections/`                        |
| Filenames  | `list-light.png`, `list-dark.png`                  |

### Create New Document

| Property   | Value                                                  |
| ---------- | ------------------------------------------------------ |
| URL        | `http://localhost:4200/admin/collections/articles/new` |
| Output Dir | `docs/visuals/collections/`                            |
| Filenames  | `create-light.png`, `create-dark.png`                  |

### Create Flow (Video)

| Property | Value              |
| -------- | ------------------ |
| Filename | `create-flow.webm` |

```bash
agent-browser record start docs/visuals/collections/create-flow.webm
agent-browser open "http://localhost:4200/admin/collections/articles/new"
agent-browser wait --load networkidle
agent-browser wait 1000
agent-browser snapshot -i
# Fill title
agent-browser fill @e<title> "My First Article"
agent-browser wait 500
# Fill other fields as appropriate
# Click save
agent-browser click @e<save-button>
agent-browser wait --load networkidle
agent-browser wait 1500
agent-browser record stop
```

Note: Replace `@e<title>` and `@e<save-button>` with actual refs from `snapshot -i`.

### Edit Document

| Property   | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| URL        | `http://localhost:4200/admin/collections/articles/:id/edit` |
| Output Dir | `docs/visuals/collections/`                                 |
| Filenames  | `edit-light.png`, `edit-dark.png`                           |

Note: Requires an existing document. Navigate to the list first, click the first item, then screenshot.

### View Document

| Property   | Value                                                  |
| ---------- | ------------------------------------------------------ |
| URL        | `http://localhost:4200/admin/collections/articles/:id` |
| Output Dir | `docs/visuals/collections/`                            |
| Filenames  | `view-light.png`, `view-dark.png`                      |

### Bulk Actions

| Property  | Value                                              |
| --------- | -------------------------------------------------- |
| URL       | `http://localhost:4200/admin/collections/articles` |
| Filenames | `bulk-actions.png`                                 |

Steps: Select multiple items using checkboxes, then screenshot showing the bulk action bar.

---

## Field Types

### Field Types Showcase

| Property   | Value                                                          |
| ---------- | -------------------------------------------------------------- |
| URL        | `http://localhost:4200/admin/collections/field-test-items/new` |
| Output Dir | `docs/visuals/fields/`                                         |
| Filenames  | `all-field-types-light.png`, `all-field-types-dark.png`        |

The `field-test-items` collection in the example app has examples of all field types. Use `--full` for full-page screenshot:

```bash
agent-browser open "http://localhost:4200/admin/collections/field-test-items/new"
agent-browser wait --load networkidle
agent-browser screenshot --full docs/visuals/fields/all-field-types-light.png
```

### Individual Field Types

Scroll to and capture individual sections:

| Field Type               | Filename            |
| ------------------------ | ------------------- |
| Text, textarea, slug     | `text-fields.png`   |
| Rich text editor         | `rich-text.png`     |
| Relationships            | `relationships.png` |
| Blocks                   | `blocks.png`        |
| Number, checkbox, select | `basic-fields.png`  |
| Date, email              | `date-email.png`    |
| File upload              | `file-upload.png`   |

---

## Media Library

| Property   | Value                                               |
| ---------- | --------------------------------------------------- |
| URL        | `http://localhost:4200/admin/media`                 |
| Output Dir | `docs/visuals/media/`                               |
| Filenames  | `media-library-light.png`, `media-library-dark.png` |

---

## Navigation & Chrome

### Sidebar (Desktop)

| Property   | Value                                   |
| ---------- | --------------------------------------- |
| URL        | `http://localhost:4200/admin`           |
| Output Dir | `docs/visuals/navigation/`              |
| Filenames  | `sidebar-light.png`, `sidebar-dark.png` |

Capture with viewport at 1280x800 so the sidebar is visible.

### Sidebar (Mobile)

| Property  | Value                |
| --------- | -------------------- |
| Filenames | `sidebar-mobile.png` |

```bash
agent-browser set viewport 375 812
agent-browser wait 500
# Click hamburger menu to open drawer
agent-browser snapshot -i
agent-browser click @e<hamburger>
agent-browser wait 500
agent-browser screenshot docs/visuals/navigation/sidebar-mobile.png
```

### Entity Sheet

| Property  | Value              |
| --------- | ------------------ |
| Filenames | `entity-sheet.png` |

Open the entity sheet overlay (keyboard shortcut or UI button) and capture.

---

## Plugins

### Analytics Dashboard

| Property   | Value                                   |
| ---------- | --------------------------------------- |
| URL        | `http://localhost:4200/admin/analytics` |
| Output Dir | `docs/visuals/plugins/`                 |
| Filenames  | `analytics-dashboard.png`               |

Note: Only available if the analytics plugin is enabled in `momentum.config.ts`.

### SEO Dashboard

| Property   | Value                             |
| ---------- | --------------------------------- |
| URL        | `http://localhost:4200/admin/seo` |
| Output Dir | `docs/visuals/plugins/`           |
| Filenames  | `seo-dashboard.png`               |

Note: Only available if the SEO plugin is enabled.

---

## Theme Comparison

Capture primary pages in both themes. Use the toggle or JS class manipulation:

```bash
# Light mode
agent-browser eval "document.documentElement.classList.remove('dark')"
agent-browser wait 500
agent-browser screenshot docs/visuals/theme/light-overview.png

# Dark mode
agent-browser eval "document.documentElement.classList.add('dark')"
agent-browser wait 500
agent-browser screenshot docs/visuals/theme/dark-overview.png

# Reset
agent-browser eval "document.documentElement.classList.remove('dark')"
```

### Theme Toggle Video

```bash
agent-browser record start docs/visuals/theme/theme-toggle.webm
agent-browser open "http://localhost:4200/admin"
agent-browser wait --load networkidle
agent-browser wait 1000
# Click theme toggle
agent-browser snapshot -i
agent-browser click @e<theme-toggle>
agent-browser wait 1500
agent-browser click @e<theme-toggle>
agent-browser wait 1500
agent-browser record stop
```

---

## Responsive

Capture the dashboard at each breakpoint:

| Breakpoint    | Width x Height | Filename           |
| ------------- | -------------- | ------------------ |
| Mobile        | 375 x 812      | `mobile-375.png`   |
| Tablet        | 768 x 1024     | `tablet-768.png`   |
| Desktop       | 1280 x 800     | `desktop-1280.png` |
| Large Desktop | 1920 x 1080    | `desktop-1920.png` |

Output dir: `docs/visuals/responsive/`

---

## Kitchen Sink

### Kitchen Sink Overview

| Property   | Value                                     |
| ---------- | ----------------------------------------- |
| URL        | `http://localhost:4200/kitchen-sink`      |
| Output Dir | `docs/visuals/kitchen-sink/`              |
| Filenames  | `overview-light.png`, `overview-dark.png` |

Use `--full` for full-page screenshot to capture all component sections:

```bash
agent-browser open "http://localhost:4200/kitchen-sink"
agent-browser wait --load networkidle
agent-browser screenshot --full docs/visuals/kitchen-sink/overview-light.png
```

### Individual Component Sections

Scroll to each section and capture:

| Section      | Filename         |
| ------------ | ---------------- |
| Buttons      | `buttons.png`    |
| Forms/Inputs | `forms.png`      |
| Cards        | `cards.png`      |
| Data Tables  | `data-table.png` |
| Tabs         | `tabs.png`       |
| Accordion    | `accordion.png`  |
| Dialogs      | `dialogs.png`    |
| Alerts       | `alerts.png`     |

---

## Public Site

These depend on the example app's public routes (if any are configured):

### Home Page

| Property   | Value                       |
| ---------- | --------------------------- |
| URL        | `http://localhost:4200/`    |
| Output Dir | `docs/visuals/public-site/` |
| Filenames  | `home-light.png`            |

Note: The public site may not exist in all configurations. Skip if the route returns 404.

---

## Storybook

Requires Storybook running on port 4400: `nx storybook ui --port 4400`

### Component Stories

Navigate to individual component stories:

```bash
agent-browser open "http://localhost:4400/?path=/story/components-button--primary"
agent-browser wait --load networkidle
agent-browser screenshot docs/visuals/storybook/button-primary.png
```

Capture the most important component stories. Refer to the Storybook sidebar for available stories.

Note: This is a supplementary capture. The kitchen sink is preferred for component documentation since it shows real usage context.
