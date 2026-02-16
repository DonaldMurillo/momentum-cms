# Tailwind Setup

Apps using the admin library must configure Tailwind to include the admin preset and library sources.

## Configuration

### `tailwind.config.js`

```javascript
const { join } = require('path');
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const adminPreset = require('../../libs/admin/tailwind.preset');

module.exports = {
	presets: [adminPreset],
	content: [
		join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
		join(__dirname, '../../libs/admin/src/**/*.{ts,html}'),
		...createGlobPatternsForDependencies(__dirname),
	],
};
```

The admin preset provides:

- Dark mode via `.dark` class
- Semantic color system mapped to CSS variables
- Custom border radius from `--mcms-radius`
- Animation keyframes for accordions, dialogs, tooltips, and popovers

### `styles.css`

Angular's esbuild bundler can't resolve CSS imports from libraries, so theme variables must be included inline:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
	:root {
		--mcms-background: 0 0% 100%;
		--mcms-foreground: 222 47% 11%;
		--mcms-card: 0 0% 100%;
		--mcms-card-foreground: 222 47% 11%;
		--mcms-primary: 221 83% 53%;
		--mcms-primary-foreground: 210 40% 98%;
		--mcms-secondary: 210 40% 96%;
		--mcms-secondary-foreground: 222 47% 11%;
		--mcms-muted: 210 40% 96%;
		--mcms-muted-foreground: 215 16% 47%;
		--mcms-accent: 210 40% 96%;
		--mcms-accent-foreground: 222 47% 11%;
		--mcms-destructive: 0 84% 60%;
		--mcms-destructive-foreground: 210 40% 98%;
		--mcms-success: 142 76% 36%;
		--mcms-success-foreground: 210 40% 98%;
		--mcms-warning: 38 92% 50%;
		--mcms-warning-foreground: 222 47% 11%;
		--mcms-info: 199 89% 48%;
		--mcms-info-foreground: 210 40% 98%;
		--mcms-border: 214 32% 91%;
		--mcms-input: 214 32% 91%;
		--mcms-ring: 221 83% 53%;
		--mcms-radius: 0.5rem;
		--mcms-sidebar-background: 222 47% 11%;
		--mcms-sidebar-foreground: 210 40% 98%;
		--mcms-sidebar-primary: 217 91% 60%;
		--mcms-sidebar-accent: 217 33% 17%;
		--mcms-sidebar-border: 217 33% 17%;
		--mcms-sidebar-ring: 217 91% 60%;
	}

	.dark {
		--mcms-background: 222 47% 11%;
		--mcms-foreground: 210 40% 98%;
		--mcms-card: 217 33% 15%;
		--mcms-card-foreground: 210 40% 98%;
		--mcms-primary: 217 91% 60%;
		--mcms-primary-foreground: 222 47% 11%;
		--mcms-secondary: 217 33% 17%;
		--mcms-secondary-foreground: 210 40% 98%;
		--mcms-muted: 217 33% 17%;
		--mcms-muted-foreground: 215 20% 65%;
		--mcms-accent: 217 33% 17%;
		--mcms-accent-foreground: 210 40% 98%;
		--mcms-destructive: 0 63% 31%;
		--mcms-destructive-foreground: 210 40% 98%;
		--mcms-success: 142 76% 36%;
		--mcms-success-foreground: 210 40% 98%;
		--mcms-warning: 38 92% 50%;
		--mcms-warning-foreground: 222 47% 11%;
		--mcms-info: 199 89% 48%;
		--mcms-info-foreground: 210 40% 98%;
		--mcms-border: 217 33% 17%;
		--mcms-input: 217 33% 17%;
		--mcms-ring: 217 91% 60%;
		--mcms-sidebar-background: 222 47% 11%;
		--mcms-sidebar-foreground: 210 40% 98%;
		--mcms-sidebar-primary: 217 91% 60%;
		--mcms-sidebar-accent: 217 33% 17%;
		--mcms-sidebar-border: 217 33% 17%;
		--mcms-sidebar-ring: 217 91% 60%;
	}

	* {
		border-color: hsl(var(--mcms-border));
	}

	body {
		background-color: hsl(var(--mcms-background));
		color: hsl(var(--mcms-foreground));
	}
}
```

## Preset Colors

The preset maps CSS variables to Tailwind utilities:

| Tailwind Class    | CSS Variable         |
| ----------------- | -------------------- |
| `bg-background`   | `--mcms-background`  |
| `text-foreground` | `--mcms-foreground`  |
| `bg-card`         | `--mcms-card`        |
| `bg-primary`      | `--mcms-primary`     |
| `bg-secondary`    | `--mcms-secondary`   |
| `bg-muted`        | `--mcms-muted`       |
| `bg-accent`       | `--mcms-accent`      |
| `bg-destructive`  | `--mcms-destructive` |
| `bg-success`      | `--mcms-success`     |
| `bg-warning`      | `--mcms-warning`     |
| `bg-info`         | `--mcms-info`        |
| `border-border`   | `--mcms-border`      |
| `border-input`    | `--mcms-input`       |
| `ring-ring`       | `--mcms-ring`        |

Each color includes a `-foreground` variant for text on that background (e.g., `text-primary-foreground`).

## Preset Animations

The preset includes keyframes for UI components:

- `accordion-down` / `accordion-up`
- `fade-in` / `fade-out`
- `slide-in-from-right` / `slide-in-from-left` / `slide-in-from-top` / `slide-in-from-bottom`
- `dialog-overlay-in` / `dialog-content-in` / `dialog-content-out`
- `tooltip-in` / `popover-in` / `dropdown-in`

## Related

- [Theme](theme.md) — Dark mode and CSS variables
- [Admin Overview](overview.md) — Dashboard structure
