# Headless UI Component Library

Zero-style, behavior-only Angular components built on @angular/aria + @angular/cdk.

## Key Rules

- **No styles whatsoever** — no `host: { class: ... }`, no `styles: [...]`, no Tailwind, no CSS variables
- **No `class` input** — consumers style via their own CSS on the host element
- **Expose behavior only** — ARIA attributes, keyboard navigation, focus management, state signals
- **Expose underlying directive** — `inject()` the @angular/aria directive so advanced consumers can access it
- Selector prefix: `hdl-` (components), `hdl` (directives, camelCase)
- All components: `ChangeDetectionStrategy.OnPush`, signal inputs/outputs, `template: '<ng-content />'`
- No wrapper divs (use host element)

## Component Patterns

### Aria-Wrapped (accordion, tabs, menu, listbox, combobox, grid, tree, toolbar)

```typescript
@Component({
  selector: 'hdl-accordion',
  hostDirectives: [{ directive: AccordionGroup, inputs: [...], outputs: [...] }],
  template: `<ng-content />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlAccordion {
  readonly ariaDirective = inject(AccordionGroup);
  readonly disabled = input(false);
}
```

### CDK-Composed (dialog, popover, tooltip, toast)

Use CDK Overlay for positioning, CDK A11y for focus management. Set semantic ARIA attributes on host. No visual styles.

### Native Behavior (switch, checkbox, radio-group)

Use native ARIA roles and keyboard handling. No @angular/aria dependency for these.
