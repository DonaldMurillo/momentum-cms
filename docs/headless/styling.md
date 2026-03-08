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
- Popover: `.hdl-popover-panel`, `.hdl-popover-backdrop`
- Tooltip: `.hdl-tooltip-panel`

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
