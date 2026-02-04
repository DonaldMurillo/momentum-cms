# UI Component Library

Angular component library following shadcn/ui patterns with Tailwind CSS.

## Component Patterns

### Host Element (No Wrapping Divs)

Angular components create a host element. Use `host` property for Tailwind styles.

**Bad:**

```typescript
@Component({
  selector: 'mcms-card',
  template: `<div class="rounded-lg border bg-card"><ng-content /></div>`,
})
```

**Good:**

```typescript
@Component({
  selector: 'mcms-card',
  host: { class: 'rounded-lg border bg-card block' },
  template: `<ng-content />`,
})
```

### Class Input for Customization

Accept `class` input and merge with host classes.

**Bad:**

```typescript
@Component({
  host: { class: 'flex gap-2' }, // No way to customize
})
```

**Good:**

```typescript
@Component({
	host: { '[class]': 'hostClasses()' },
})
export class MyComponent {
	readonly class = input('');
	readonly hostClasses = computed(() => `flex gap-2 ${this.class()}`.trim());
}
```

### Flex Child Wrappers

For wrapper components inside flex layouts, use `shrink-0` to prevent shrinking.

**Bad:**

```typescript
// admin-sidebar-widget wraps mcms-sidebar
// Default block display breaks flex layout height
@Component({
  selector: 'mcms-admin-sidebar',
  template: `<mcms-sidebar>...</mcms-sidebar>`,
})
```

**Good:**

```typescript
@Component({
  selector: 'mcms-admin-sidebar',
  host: { class: 'shrink-0' }, // Proper flex child - won't shrink
  template: `<mcms-sidebar>...</mcms-sidebar>`,
})
```

**Note:** Avoid `class="contents"` - it breaks height inheritance. Avoid `h-full` without a proper height chain from parent.

### Sidebar Layout Pattern (Footer at Bottom)

For sidebars with header, scrollable content, and footer pinned to bottom:

**Parent aside:**

```typescript
'flex flex-col h-screen sticky top-0'; // Fixed viewport height
```

**Template structure:**

```html
<aside class="flex flex-col h-screen sticky top-0">
	<!-- Header: fixed size at top -->
	<div class="shrink-0 px-3 py-4">
		<ng-content select="[header]" />
	</div>

	<!-- Content: fills remaining space, scrolls if needed -->
	<div class="flex-1 overflow-y-auto px-2">
		<ng-content select="[content]" />
	</div>

	<!-- Footer: fixed size at bottom -->
	<div class="shrink-0 border-t px-2 py-2">
		<ng-content select="[footer]" />
	</div>
</aside>
```

**Key points:**

- `h-screen` on aside ensures exact viewport height (not `min-h-screen`)
- `flex-1` on content takes ALL remaining space, pushing footer to bottom
- `shrink-0` on header/footer prevents them from shrinking
- `overflow-y-auto` on content enables scrolling when content is tall

### Signal Inputs (Angular 21)

Use signal-based inputs, not decorators.

**Bad:**

```typescript
@Input() label = '';
@Input({ required: true }) value!: string;
```

**Good:**

```typescript
readonly label = input('');
readonly value = input.required<string>();
```

### Signal Outputs (Angular 21)

Use signal-based outputs, not decorators.

**Bad:**

```typescript
@Output() clicked = new EventEmitter<void>();
```

**Good:**

```typescript
readonly clicked = output<void>();
```

### OnPush Change Detection

Always use OnPush for performance.

**Bad:**

```typescript
@Component({ ... }) // Uses Default change detection
```

**Good:**

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

### Control Flow Syntax

Use new control flow, not structural directives.

**Bad:**

```typescript
template: `
  <div *ngIf="isOpen">Content</div>
  <div *ngFor="let item of items">{{ item }}</div>
`;
```

**Good:**

```typescript
template: `
  @if (isOpen()) {
    <div>Content</div>
  }
  @for (item of items(); track item.id) {
    <div>{{ item }}</div>
  }
`;
```

## CDK & ARIA Patterns

### CDK BreakpointObserver (Responsive)

Use CDK BreakpointObserver, not `window.innerWidth`.

**Bad:**

```typescript
ngOnInit(): void {
  this.isMobile = window.innerWidth < 768;
  window.addEventListener('resize', () => {
    this.isMobile = window.innerWidth < 768;
  });
}
```

**Good:**

```typescript
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';

readonly isMobile = toSignal(
  this.breakpointObserver.observe(['(max-width: 767px)'])
    .pipe(map(result => result.matches)),
  { initialValue: false }
);
```

### CDK FocusTrap (Modals/Drawers)

Use `cdkTrapFocus` for modals and mobile drawers.

**Bad:**

```typescript
// No focus management
template: `<div class="modal">...</div>`;
```

**Good:**

```typescript
import { A11yModule } from '@angular/cdk/a11y';

template: `
  <div
    cdkTrapFocus
    [cdkTrapFocusAutoCapture]="isOpen()"
    role="dialog"
    [attr.aria-modal]="isOpen() || null"
  >
    ...
  </div>
`;
```

### CDK Overlay (Positioned Content)

Use CDK Overlay for dropdowns, tooltips, popovers.

**Bad:**

```typescript
// Manual absolute positioning
template: `
  <div class="relative">
    <div class="absolute top-full left-0">Dropdown</div>
  </div>
`;
```

**Good:**

```typescript
import { Overlay, OverlayRef } from '@angular/cdk/overlay';

const overlayRef = this.overlay.create({
  positionStrategy: this.overlay.position()
    .flexibleConnectedTo(elementRef)
    .withPositions([...]),
  hasBackdrop: true,
});
overlayRef.backdropClick().subscribe(() => this.close());
```

### @angular/aria Directives

Use hostDirectives for semantic behavior.

**Bad:**

```typescript
// Manual keyboard handling
@HostListener('keydown', ['$event'])
onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') { ... }
}
```

**Good:**

```typescript
import { Menu, MenuItem } from '@angular/aria/menu';

@Component({
	hostDirectives: [{ directive: Menu, inputs: ['disabled'], outputs: ['onSelect'] }],
})
export class DropdownMenu {}
```

## Icons (ng-icons)

Use ng-icons with provideIcons.

**Bad:**

```typescript
// Inline SVG or font icons
template: `<i class="fa fa-bars"></i>`;
```

**Good:**

```typescript
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroBars3 } from '@ng-icons/heroicons/outline';

@Component({
  imports: [NgIcon],
  providers: [provideIcons({ heroBars3 })],
  template: `<ng-icon name="heroBars3" size="24" />`,
})
```

## Responsive Design

### Breakpoint Alignment

Keep breakpoints consistent between CSS (Tailwind) and JS (CDK).

**Bad:**

```typescript
// CSS uses lg: (1024px), JS uses 767px
template: `<header class="lg:hidden">...` // Hidden at 1024px+
readonly isMobile = // detects at 768px
```

**Good:**

```typescript
// Both use 768px (md breakpoint)
template: `<header class="md:hidden">...` // Hidden at 768px+
readonly isMobile = toSignal(
  this.breakpointObserver.observe(['(max-width: 767px)'])
);
```

### Mobile-First Design

Desktop styles override mobile defaults.

**Bad:**

```typescript
// Desktop-first (hide on mobile)
host: { class: 'flex hidden sm:flex' }
```

**Good:**

```typescript
// Mobile-first (show on larger)
host: { class: 'hidden md:flex' }
```

## Testing

### Test Computed Signals

Signal effects may need multiple change detection cycles.

**Bad:**

```typescript
fixture.componentRef.setInput('collapsed', true);
fixture.detectChanges();
expect(aside.style.width).toBe('4rem'); // May fail
```

**Good:**

```typescript
fixture.componentRef.setInput('collapsed', true);
fixture.detectChanges();
await fixture.whenStable();
fixture.detectChanges(); // Effects may need second cycle
await fixture.whenStable();
expect(aside.style.width).toBe('4rem');
```

### Query Inside Template

When host uses `class="contents"`, query actual rendered elements.

**Bad:**

```typescript
// Host is invisible (contents), classes not on host
expect(fixture.nativeElement.classList.contains('flex')).toBe(true);
```

**Good:**

```typescript
// Query the actual aside element
const aside = fixture.nativeElement.querySelector('aside');
expect(aside.classList.contains('flex')).toBe(true);
```

## File Organization

```
libs/ui/src/lib/
├── button/
│   ├── button.component.ts
│   ├── button.spec.ts
│   ├── button.stories.ts
│   └── index.ts
├── sidebar/
│   ├── sidebar.component.ts
│   ├── sidebar-header.component.ts
│   ├── sidebar-content.component.ts
│   ├── sidebar-footer.component.ts
│   ├── sidebar-nav.component.ts
│   ├── sidebar-nav-item.component.ts
│   ├── sidebar-section.component.ts
│   ├── sidebar-trigger.component.ts
│   ├── sidebar.service.ts
│   ├── sidebar.spec.ts
│   └── index.ts
└── index.ts (barrel exports)
```
