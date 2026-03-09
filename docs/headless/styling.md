# Headless UI Styling

`@momentumcms/headless` is meant to be styled from the app's global CSS layer, not from styles bundled into the library.

## Styling Contract

Every primitive exposes a stable `data-slot` attribute on its host so you can target it without depending on raw tag names alone.

Common state attributes:

- `data-state` for primary state like `open`, `closed`, `checked`, `unchecked`, `selected`, `unselected`, `visible`, or `hidden`
- `data-disabled="true"` when a primitive is disabled
- `data-active="true"` when the underlying Angular Aria pattern marks the item active
- `data-orientation="horizontal|vertical"` where orientation matters
- `data-multiple="true"` for multi-select or multi-expand containers

Overlay primitives also expose stable panel or backdrop selectors:

- Dialog: `.hdl-dialog-panel`, `.hdl-dialog-backdrop`
- Drawer: `.hdl-drawer-panel`, `.hdl-drawer-backdrop`
- Popover: `.hdl-popover-panel`, `.hdl-popover-backdrop`
- Tooltip: `.hdl-tooltip-panel`
- Context menu: `.hdl-context-menu-panel`, `.hdl-context-menu-backdrop`
- Hover card: `.hdl-hover-card-panel`

Form primitives also expose stable field slots:

- Field: `field`, `label`, `description`, `error`
- Text entry: `input`, `textarea`
- Chips: `chips`, `chip`, `chip-input`, `chip-remove`
- Select: `select`, `select-trigger`, `select-value`, `select-content`, `select-item`
- Command: `command`, `command-input`, `command-list`, `command-item`, `command-empty`, `command-group`, `command-separator`
- Disclosure and toggles: `collapsible`, `collapsible-trigger`, `collapsible-content`, `toggle`, `toggle-group`, `toggle-item`
- Structural feedback: `separator`, `progress`, `spinner`, `skeleton`
- Context and sheet surfaces: `context-menu-content`, `hover-card-content`, `alert-dialog`, `alert-dialog-title`, `alert-dialog-description`, `alert-dialog-action`, `alert-dialog-cancel`, `drawer`, `drawer-title`, `drawer-description`, `drawer-close`

## Recommended Tailwind Structure

Define tokens in `@layer base` and component recipes in `@layer components`.

```css
@layer base {
	:root {
		--hdl-radius: 0.75rem;
		--hdl-bg: 0 0% 100%;
		--hdl-fg: 222 47% 11%;
		--hdl-border: 214 32% 85%;
		--hdl-primary: 221 83% 48%;
		--hdl-muted: 210 40% 96%;
	}
}

@layer components {
	[data-slot='switch'] {
		@apply inline-flex h-6 w-11 items-center rounded-full transition;
		background-color: hsl(var(--hdl-muted));
	}

	[data-slot='switch'][data-state='checked'] {
		background-color: hsl(var(--hdl-primary));
	}

	[data-slot='dialog'] {
		@apply rounded-2xl border p-6 shadow-2xl;
		background-color: hsl(var(--hdl-bg));
		color: hsl(var(--hdl-fg));
		border-color: hsl(var(--hdl-border));
	}

	[data-slot='field'] {
		@apply flex flex-col gap-3;
	}

	[data-slot='input'],
	[data-slot='textarea'] {
		@apply w-full rounded-2xl border px-4 py-3;
		border-color: hsl(var(--hdl-border));
		background-color: hsl(var(--hdl-bg));
		color: hsl(var(--hdl-fg));
	}

	[data-slot='chips'] {
		@apply flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-3;
		border-color: hsl(var(--hdl-border));
		background-color: hsl(var(--hdl-bg));
	}

	.hdl-dialog-backdrop {
		background: rgb(15 23 42 / 0.45);
		backdrop-filter: blur(4px);
	}
}
```

## Ad Hoc Overrides

You can still put `class=""` directly on the primitive host for one-off usage:

```html
<hdl-dialog class="w-[40rem] rounded-xl border bg-white p-6 shadow-xl">
	<hdl-dialog-title class="block text-xl font-semibold">Delete post</hdl-dialog-title>
</hdl-dialog>
```

For primitives that render your own inner content, style the children you project in:

```html
<hdl-switch class="settings-switch">
	<span class="thumb"></span>
</hdl-switch>
```

```css
@layer components {
	.settings-switch > .thumb {
		@apply h-5 w-5 rounded-full bg-white transition;
		transform: translateX(2px);
	}

	.settings-switch[data-state='checked'] > .thumb {
		transform: translateX(22px);
	}
}
```

## Testing Customization

Treat the styling surface as a contract, not as incidental markup.

- Unit specs in `libs/headless` should assert stable `data-slot` and state attributes on hosts plus overlay selectors for dialog, popover, and tooltip.
- The Angular example app exposes a live styling harness at `/headless-styling-lab`, and it starts with a coverage matrix so every currently exported primitive family is visible before the detailed demos.
- The lab route is intentionally client-rendered in the example app. It is a demo/test harness with many interactive primitives, and treating it as SEO-worthy SSR content only makes the server eat glue.
- The lab now includes a dedicated form-foundations section for field semantics, input, textarea, and chips with visible state readouts, not just selection and overlay primitives.
- The lab also includes extended utility coverage for collapsible, toggle, select, command, separator, progress, spinner, skeleton, context menu, hover card, alert dialog, and drawer.
- The matrix is an inventory, not fake navigation. If a primitive is not shipped yet, say so explicitly on the page instead of linking somewhere misleading or silently omitting it.
- The lab should pair each primitive with a visible readout or outcome. For example, the combobox shows all primitives first, filters them live, and records the selected value instead of pretending a styled list alone proves anything.
- Browser coverage lives in `libs/e2e-tests/src/specs/headless-styling.spec.ts` and checks inventory presence, theme switching, global defaults, scoped overrides, ad hoc overrides, overlay primitives, hidden-region behavior, functional readouts for each primitive family, and the public `/showcase` link into the lab.

## Guardrails

- When a primitive uses `[hidden]` for collapsed or inactive content, the global layer must preserve that behavior with an explicit `[hidden] { display: none; }` rule for the affected slot.
- Prefer host-scoped custom properties for ad hoc overrides so one-off variants can change tokens or geometry without breaking projected child elements like switch thumbs.
- Rounded popup hosts such as menus, listboxes, and combobox popups should be block-level and usually need `overflow: hidden` so inline descendants or nested backgrounds do not leak corner artifacts.
- Custom-element list descendants such as `select-item` and `command-item` also need an explicit block-level display contract in the global layer. If you skip that, the browser happily renders your "list" like a smug inline text run.
- Fixed-position containers like the toast viewport need an explicit width; otherwise the custom-element host can collapse to `0px` and clip the rendered content.
- Drawer hosts should fill the overlay pane with `width: 100%` and `height: 100%`, then apply side-aware border radii on the host. Otherwise you get a floating card in the corner and call it a drawer, which is embarrassing for everyone involved.
- Use the interaction the demo reliably exposes in the browser. In the current lab, tooltip coverage uses hover and the listbox demo stays single-select because that is the behavior the harness proves cleanly.
