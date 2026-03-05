---
name: component
description: Generate an Angular component with signals, OnPush, and host-based styling following Momentum CMS conventions.
argument-hint: <component-name>
---

# Generate Angular Component

Create an Angular component following Momentum CMS conventions.

## Arguments

- `$ARGUMENTS` - Component name in kebab-case (e.g., "data-table", "post-card")

## Steps

1. Create component file at `src/app/components/<component>.ts` (or `src/app/<feature>/<component>.ts`)

2. Use this template:

```typescript
import { ChangeDetectionStrategy, Component, computed, input, output, signal, inject } from '@angular/core';

@Component({
  selector: 'app-<component-name>',
  host: { class: 'block' },
  template: `
    <!-- Template here -->
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class <PascalName>Component {
  // Signal inputs (use proper types, never `any`)
  readonly data = input.required<DataType>();

  // Optional inputs with defaults
  readonly disabled = input(false);

  // Signal outputs
  readonly valueChange = output<ValueType>();

  // Internal state
  private readonly _loading = signal(false);

  // Computed values
  readonly loading = this._loading.asReadonly();
  readonly hasData = computed(() => !!this.data());
}
```

## Key Conventions

- **NO `standalone: true`** — default in Angular 21, redundant
- **NO `any` types** — use proper interfaces
- **NO `CommonModule` import** — unnecessary in Angular 21
- Always use `ChangeDetectionStrategy.OnPush`
- Use `input()` and `input.required()` for inputs
- Use `output()` for outputs
- Use `signal()` for internal state, `computed()` for derived values
- Use `inject()` for dependency injection
- Use `@for`/`@if`/`@switch` control flow

## UI Component Patterns

### No Wrapping Divs

Angular components create a host element. Style the host directly — do NOT add wrapper divs:

```typescript
@Component({
  selector: 'app-button',
  host: { class: 'inline-flex items-center gap-2' },
  template: `<ng-content />`,
})
```

NOT:

```typescript
// BAD: unnecessary wrapper div
template: `<div class="inline-flex items-center gap-2"><ng-content /></div>`,
```

### Theme Service

Use `McmsThemeService` for dark mode support:

```typescript
import { McmsThemeService } from '@momentumcms/admin';

@Component({...})
export class MyComponent {
  private readonly theme = inject(McmsThemeService);

  toggleDarkMode(): void {
    this.theme.toggleTheme();
  }

  readonly isDark = this.theme.isDark;           // computed signal
  readonly currentTheme = this.theme.theme;      // 'light' | 'dark' | 'system'
}
```

## Tailwind Setup

The project uses the `@momentumcms/admin` Tailwind preset and CSS variables for theming.

### tailwind.config.js

```javascript
const adminPreset = require('@momentumcms/admin/tailwind.preset');

module.exports = {
	presets: [adminPreset],
	content: [
		'./src/**/*.{html,ts}',
		'./node_modules/@momentumcms/admin/**/*.{html,ts,mjs}',
		'./node_modules/@momentumcms/ui/**/*.{html,ts,mjs}',
	],
};
```

### styles.css

CSS variables are defined in `src/styles.css` with `:root` (light) and `.dark` variants. All use HSL values referenced via `hsl(var(--mcms-<name>))`. Key tokens:

- `--mcms-background/foreground` — page background and text
- `--mcms-primary/primary-foreground` — primary actions (blue)
- `--mcms-card/card-foreground` — card surfaces
- `--mcms-muted/muted-foreground` — subtle backgrounds
- `--mcms-destructive` — danger/delete actions
- `--mcms-sidebar` — sidebar-specific colors
- `--mcms-border`, `--mcms-input`, `--mcms-ring` — form elements
- `--mcms-radius` — border radius base

Use Tailwind utility classes that reference these tokens (e.g., `bg-background`, `text-foreground`, `border-border`).
