# Accessibility Checklist

WCAG 2.1 AA compliance requirements for Momentum CMS UI components.

## ARIA Attributes

### Roles

Use native HTML elements when possible. Only add roles when needed:

```typescript
// Native elements have implicit roles
<button>     // role="button" implicit
<input>      // role="textbox" implicit
<a href="">  // role="link" implicit

// Custom elements need explicit roles
host: {
  'role': 'checkbox',
  '[attr.aria-checked]': 'checked()',
}
```

### Common ARIA Attributes

| Attribute          | Use Case                   | Example                 |
| ------------------ | -------------------------- | ----------------------- |
| `aria-label`       | Non-text content           | Icon buttons, images    |
| `aria-labelledby`  | Label from another element | Form fields             |
| `aria-describedby` | Additional description     | Error messages          |
| `aria-expanded`    | Expandable content         | Accordions, dropdowns   |
| `aria-selected`    | Selectable items           | Tabs, list items        |
| `aria-disabled`    | Disabled state             | Any interactive element |
| `aria-hidden`      | Decorative content         | Icons with text         |
| `aria-live`        | Dynamic content            | Toasts, alerts          |
| `aria-haspopup`    | Opens popup                | Dropdown triggers       |
| `aria-controls`    | Controls another element   | Tab → panel             |

### Component-Specific Requirements

**Button:**

```typescript
host: {
  'role': 'button',  // If not native <button>
  '[attr.aria-disabled]': 'disabled()',
  '[attr.aria-pressed]': 'pressed()',  // For toggle buttons
}
```

**Checkbox:**

```typescript
host: {
  'role': 'checkbox',
  '[attr.aria-checked]': 'indeterminate() ? "mixed" : checked()',
  '[attr.aria-disabled]': 'disabled()',
}
```

**Dialog:**

```typescript
host: {
  'role': 'dialog',
  'aria-modal': 'true',
  '[attr.aria-labelledby]': 'titleId',
}
```

**Tabs:**

```typescript
// Tab list
'role': 'tablist',
'[attr.aria-orientation]': 'orientation()',

// Tab trigger
'role': 'tab',
'[attr.aria-selected]': 'isSelected()',
'[attr.aria-controls]': 'panelId',

// Tab panel
'role': 'tabpanel',
'[attr.aria-labelledby]': 'tabId',
```

**Dropdown/Menu:**

```typescript
// Trigger
'[attr.aria-expanded]': 'open()',
'[attr.aria-haspopup]': '"menu"',

// Menu
'role': 'menu',

// Menu item
'role': 'menuitem',
```

## Focus Management

### Visible Focus Indicator

All interactive elements must have visible focus:

```css
/* Use :focus-visible for keyboard focus only */
:host:focus-visible {
	outline: 2px solid hsl(var(--mcms-ring));
	outline-offset: 2px;
}

/* Or use Tailwind */
@apply focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
```

### Tab Order

Ensure logical tab order:

- Use native focusable elements when possible
- Set `tabindex="0"` for custom interactive elements
- Set `tabindex="-1"` for programmatically focusable elements
- Never use `tabindex` > 0

```typescript
host: {
  'tabindex': '0',  // Make focusable
}

// Or conditionally
'[tabindex]': 'disabled() ? -1 : 0',
```

### Focus Trap (Modals)

Modals must trap focus:

```typescript
// Use CDK FocusTrap or manual implementation
import { FocusTrapFactory } from '@angular/cdk/a]';

// Trap focus when modal opens
// Restore focus when modal closes
```

### Skip Links

For complex layouts, provide skip links:

```html
<a href="#main-content" class="sr-only focus:not-sr-only"> Skip to main content </a>
```

## Keyboard Navigation

### Standard Patterns

| Component | Keys             | Action         |
| --------- | ---------------- | -------------- |
| Button    | Enter, Space     | Activate       |
| Link      | Enter            | Navigate       |
| Checkbox  | Space            | Toggle         |
| Radio     | Arrow Up/Down    | Move selection |
| Tabs      | Arrow Left/Right | Switch tabs    |
| Menu      | Arrow Up/Down    | Navigate items |
| Menu      | Enter, Space     | Select item    |
| Menu      | Escape           | Close          |
| Dialog    | Escape           | Close          |
| Accordion | Enter, Space     | Toggle section |
| Tree      | Arrow keys       | Navigate       |

### Implementation

```typescript
@HostListener('keydown', ['$event'])
onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault();
      this.activate();
      break;
    case 'Escape':
      this.close();
      break;
    case 'ArrowDown':
      event.preventDefault();
      this.focusNext();
      break;
    case 'ArrowUp':
      event.preventDefault();
      this.focusPrevious();
      break;
  }
}
```

## Color and Contrast

### Minimum Contrast Ratios

| Content Type       | Ratio | Example           |
| ------------------ | ----- | ----------------- |
| Normal text        | 4.5:1 | Body copy, labels |
| Large text (18pt+) | 3:1   | Headings          |
| UI components      | 3:1   | Borders, icons    |
| Focus indicators   | 3:1   | Focus rings       |

### Testing Contrast

Use browser DevTools or tools like:

- Chrome DevTools color picker
- WebAIM Contrast Checker
- axe DevTools extension

### Don't Rely on Color Alone

```html
<!-- BAD: Color only indicates error -->
<input class="border-red-500" />

<!-- GOOD: Icon + color + message -->
<input class="border-red-500" aria-invalid="true" />
<span class="text-red-500">
	<svg aria-hidden="true"><!-- error icon --></svg>
	Error: Invalid email
</span>
```

## Screen Reader Support

### Hidden Elements

```typescript
// Hide decorative elements
<svg aria-hidden="true">...</svg>

// Screen reader only text
<span class="sr-only">Close dialog</span>

// Or with Tailwind
class="sr-only"  // Visually hidden but accessible
```

### Live Regions

For dynamic content:

```html
<!-- Polite: announced after current content -->
<div aria-live="polite">{{ statusMessage }}</div>

<!-- Assertive: announced immediately -->
<div aria-live="assertive" role="alert">{{ errorMessage }}</div>
```

### Announcements

For toast/notifications:

```typescript
// ToastService should manage aria-live regions
showToast(message: string) {
  // Inject message into aria-live region
}
```

## Audit Checklist

### ARIA Audit

- [ ] Uses native semantic elements where possible
- [ ] Custom controls have appropriate `role`
- [ ] `aria-label` on icon-only buttons
- [ ] `aria-expanded` on expandable triggers
- [ ] `aria-selected` on selectable items
- [ ] `aria-disabled` on disabled controls
- [ ] `aria-hidden` on decorative content
- [ ] No redundant ARIA (e.g., `role="button"` on `<button>`)

### Focus Audit

- [ ] Visible focus indicator (`:focus-visible`)
- [ ] Logical tab order (no positive tabindex)
- [ ] Focus trapped in modals
- [ ] Focus restored after modal close
- [ ] Disabled elements not focusable

### Keyboard Audit

- [ ] All interactions possible via keyboard
- [ ] Standard key patterns followed
- [ ] No keyboard traps
- [ ] Escape closes overlays

### Color/Contrast Audit

- [ ] Text contrast 4.5:1 minimum
- [ ] UI component contrast 3:1 minimum
- [ ] Focus indicator contrast 3:1 minimum
- [ ] Information not conveyed by color alone
- [ ] Works in light and dark themes

### Screen Reader Audit

- [ ] Meaningful content announced
- [ ] Decorative content hidden
- [ ] Dynamic content uses aria-live
- [ ] Form errors announced
- [ ] State changes announced

## Testing Tools

1. **Browser DevTools**
   - Accessibility panel
   - Color picker (contrast)

2. **Extensions**
   - axe DevTools
   - WAVE
   - Lighthouse

3. **Screen Readers**
   - VoiceOver (macOS)
   - NVDA (Windows)

4. **Automated**
   - Storybook a11y addon
   - jest-axe
   - Playwright accessibility
