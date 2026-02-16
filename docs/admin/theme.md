# Theme Service

`McmsThemeService` manages light/dark mode with persistence and system preference detection.

## Usage

```typescript
import { McmsThemeService } from '@momentum-cms/admin';

@Component({...})
export class MyComponent {
  private readonly theme = inject(McmsThemeService);

  readonly isDark = this.theme.isDark;
  readonly currentTheme = this.theme.resolvedTheme; // 'light' | 'dark'
}
```

## API

### Signals

| Signal          | Type                                    | Description                     |
| --------------- | --------------------------------------- | ------------------------------- |
| `theme`         | `Signal<'light' \| 'dark' \| 'system'>` | Current setting                 |
| `resolvedTheme` | `Signal<'light' \| 'dark'>`             | After system preference applied |
| `isDark`        | `Signal<boolean>`                       | Whether dark mode is active     |

### Methods

```typescript
theme.setTheme('dark'); // Set to specific theme
theme.setTheme('system'); // Follow OS preference
theme.toggleTheme(); // Toggle between light and dark
```

## How It Works

1. **Persistence** — Theme saved to `localStorage` (`mcms-theme` key) and HTTP cookie (for SSR)
2. **System preference** — When set to `'system'`, listens to `prefers-color-scheme: dark` media query
3. **DOM application** — Adds/removes `.dark` class on `<html>` element
4. **Browser only** — No-op during SSR; hydrates from cookie/localStorage on init

## CSS Variables

The theme is driven by CSS variables. The `.dark` class on `<html>` switches variable values:

```css
:root {
	--mcms-background: 0 0% 100%;
	--mcms-foreground: 222 47% 11%;
	--mcms-primary: 221 83% 53%;
	/* ... */
}

.dark {
	--mcms-background: 222 47% 11%;
	--mcms-foreground: 210 40% 98%;
	--mcms-primary: 217 91% 60%;
	/* ... */
}
```

Variables use raw HSL values (without `hsl()` wrapper) for Tailwind alpha support:

```css
/* In Tailwind classes, the variable is wrapped automatically */
bg-primary  /* → background-color: hsl(var(--mcms-primary)) */
bg-primary/50  /* → background-color: hsl(var(--mcms-primary) / 0.5) */
```

## Full Variable Reference

### Semantic Colors

| Variable             | Light          | Dark             | Purpose             |
| -------------------- | -------------- | ---------------- | ------------------- |
| `--mcms-background`  | White          | Dark blue-gray   | Page background     |
| `--mcms-foreground`  | Dark blue-gray | Near white       | Primary text        |
| `--mcms-card`        | White          | Slightly lighter | Card surfaces       |
| `--mcms-primary`     | Blue           | Brighter blue    | Primary actions     |
| `--mcms-secondary`   | Light gray     | Dark gray        | Secondary elements  |
| `--mcms-muted`       | Light gray     | Dark gray        | Muted text/surfaces |
| `--mcms-accent`      | Light gray     | Dark gray        | Accented elements   |
| `--mcms-destructive` | Red            | Red              | Destructive actions |
| `--mcms-success`     | Green          | Green            | Success states      |
| `--mcms-warning`     | Amber          | Amber            | Warning states      |
| `--mcms-info`        | Blue           | Blue             | Info states         |
| `--mcms-border`      | Light border   | Dark border      | Borders             |
| `--mcms-input`       | Light border   | Dark border      | Input borders       |
| `--mcms-sidebar`     | Dark           | Dark             | Sidebar background  |

### Other Variables

| Variable        | Default  | Purpose            |
| --------------- | -------- | ------------------ |
| `--mcms-radius` | `0.5rem` | Border radius base |
| `--mcms-ring`   | —        | Focus ring color   |

## Related

- [Tailwind Setup](tailwind-setup.md) — Preset and content paths
- [Admin Overview](overview.md) — Dashboard structure
