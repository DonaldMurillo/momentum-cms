# Angular CDK & ARIA Primitives

Reference for Angular CDK and @angular/aria primitives used in Momentum CMS UI components.

## Required Dependencies

```json
{
	"@angular/cdk": "^21.x",
	"@angular/aria": "^21.x"
}
```

## CDK Modules for UI Components

### @angular/cdk/overlay (Modals, Drawers, Tooltips)

Used for positioned overlays, dropdowns, tooltips, modals.

```typescript
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, TemplatePortal } from '@angular/cdk/portal';

// Create overlay with positioning
const overlayRef = this.overlay.create({
	positionStrategy: this.overlay
		.position()
		.flexibleConnectedTo(elementRef)
		.withPositions([{ originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' }]),
	scrollStrategy: this.overlay.scrollStrategies.reposition(),
	hasBackdrop: true,
	backdropClass: 'cdk-overlay-transparent-backdrop',
});

// Handle events
overlayRef.backdropClick().subscribe(() => this.close());
overlayRef.keydownEvents().subscribe((event) => {
	if (event.key === 'Escape') this.close();
});
```

**Used in:** Dialog, Popover, Tooltip, Dropdown, Command Palette (22+ components)

### @angular/cdk/a11y (Accessibility)

Focus trapping, focus monitoring, live announcer for screen readers.

```typescript
import { A11yModule } from '@angular/cdk/a11y';

// In template - traps focus inside modal/drawer
<div cdkTrapFocus [cdkTrapFocusAutoCapture]="isOpen">
  <!-- Modal content -->
</div>

// Focus monitoring
import { FocusMonitor } from '@angular/cdk/a11y';

private readonly focusMonitor = inject(FocusMonitor);

ngAfterViewInit(): void {
  this.focusMonitor.monitor(this.elementRef);
}

// Screen reader announcements
import { LiveAnnouncer } from '@angular/cdk/a11y';

this.liveAnnouncer.announce('Form submitted successfully');
```

**Used in:** Dialog, Sidebar (mobile drawer)

### @angular/cdk/layout (Responsive)

Reactive breakpoint detection for responsive components.

```typescript
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

// Convert to signal for reactive use
readonly isMobile = toSignal(
  this.breakpointObserver.observe(['(max-width: 767px)'])
    .pipe(map(result => result.matches)),
  { initialValue: false }
);

// Standard breakpoints
import { Breakpoints } from '@angular/cdk/layout';
// Breakpoints.Handset, Breakpoints.Tablet, Breakpoints.Web
```

**Used in:** SidebarService

## @angular/aria Patterns

### hostDirectives Pattern

Apply semantic behavior to components using hostDirectives:

```typescript
import { Menu, MenuItem } from '@angular/aria/menu';

@Component({
	selector: 'mcms-dropdown-menu',
	hostDirectives: [
		{
			directive: Menu,
			inputs: ['disabled', 'wrap', 'typeaheadDelay'],
			outputs: ['onSelect'],
		},
	],
})
export class DropdownMenu {}
```

### Available @angular/aria Directives

| Module                    | Directives                                       | Purpose                          |
| ------------------------- | ------------------------------------------------ | -------------------------------- |
| `@angular/aria/menu`      | Menu, MenuItem                                   | Keyboard nav for menus/dropdowns |
| `@angular/aria/tabs`      | Tabs, TabList, Tab, TabPanel                     | Accessible tab navigation        |
| `@angular/aria/accordion` | AccordionGroup, AccordionPanel, AccordionTrigger | Collapsible sections             |
| `@angular/aria/tree`      | Tree, TreeItem, TreeItemGroup                    | Hierarchical navigation          |
| `@angular/aria/toolbar`   | Toolbar, ToolbarWidget, ToolbarWidgetGroup       | Accessible toolbars              |
| `@angular/aria/grid`      | Grid, GridCell                                   | Accessible data grids            |

## Patterns Established in Codebase

### Overlay + Backdrop Pattern

```typescript
// 1. Create overlay with backdrop
const overlayRef = this.overlay.create({
  hasBackdrop: true,
  backdropClass: 'bg-black/50',
});

// 2. Handle backdrop click
overlayRef.backdropClick().subscribe(() => this.close());

// 3. Handle Escape key
overlayRef.keydownEvents().subscribe((event) => {
  if (event.key === 'Escape') this.close();
});

// 4. Cleanup
ngOnDestroy(): void {
  this.overlayRef?.dispose();
}
```

### Focus Trap Pattern

```typescript
@Component({
  imports: [A11yModule],
  template: `
    <div
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="isOpen()"
      role="dialog"
      [attr.aria-modal]="isOpen()"
    >
      <!-- Content -->
    </div>
  `,
})
```

### Responsive Service Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class ResponsiveService {
	private readonly breakpointObserver = inject(BreakpointObserver);
	private readonly platformId = inject(PLATFORM_ID);

	readonly isMobile = isPlatformBrowser(this.platformId)
		? toSignal(
				this.breakpointObserver
					.observe(['(max-width: 767px)'])
					.pipe(map((result) => result.matches)),
				{ initialValue: false },
			)
		: signal(false);
}
```

## Audit Checklist

When auditing components, verify:

- [ ] Uses CDK Overlay for positioned content (not custom CSS positioning)
- [ ] Uses FocusTrap (`cdkTrapFocus`) for modals and drawers
- [ ] Uses @angular/aria for semantic patterns (menus, tabs, accordions)
- [ ] Uses BreakpointObserver for responsive behavior (not window.innerWidth)
- [ ] Handles Escape key for dismissible content
- [ ] Handles backdrop click for overlay content
- [ ] Includes proper ARIA attributes (role, aria-modal, aria-expanded)
- [ ] Provides keyboard navigation (Arrow keys for lists)
- [ ] Uses LiveAnnouncer for important state changes (optional but recommended)

## Flex Layout Patterns

### Wrapper Components in Flex Layouts

When wrapping sidebar or other layout components, use proper flex child sizing:

```typescript
// BAD - contents breaks height inheritance completely
@Component({
  host: { class: 'contents' }, // NEVER use - breaks CSS height chain
})

// GOOD - proper flex child
@Component({
  host: { class: 'shrink-0' }, // Prevents shrinking in flex parent
})
```

### Sidebar Layout Pattern (Footer at Bottom)

For sidebars with header, scrollable content, and footer pinned to bottom:

**Key Requirements:**

1. Parent aside must have `h-screen` (NOT `min-h-screen`) for exact viewport height
2. Header/footer use `shrink-0` to prevent shrinking
3. Content uses `flex-1` to take ALL remaining space (pushes footer to bottom)
4. Content uses `overflow-y-auto` for scrolling when tall
5. **ng-content projections MUST be wrapped in divs** with proper flex classes

```typescript
// Sidebar component structure
@Component({
  selector: 'mcms-sidebar',
  host: { class: 'block' },
  template: `
    <aside class="flex flex-col h-screen sticky top-0">
      <!-- Header: stays at top, fixed size -->
      <div class="shrink-0 px-3 py-4">
        <ng-content select="[mcmsSidebarHeader]" />
      </div>

      <!-- Content: fills remaining space, scrolls if needed -->
      <div class="flex-1 overflow-y-auto px-2">
        <ng-content select="[mcmsSidebarContent]" />
      </div>

      <!-- Footer: pinned to bottom, fixed size -->
      <div class="shrink-0 border-t px-2 py-2">
        <ng-content select="[mcmsSidebarFooter]" />
      </div>
    </aside>
  `,
})
```

**Why `h-screen` instead of `min-h-screen`:**

- `min-h-screen` allows aside to grow beyond viewport → footer not at bottom
- `h-screen` forces exact viewport height → footer always at bottom

**Why wrapper divs around ng-content:**

- ng-content alone doesn't create a DOM element to apply flex classes to
- The wrapper divs receive `shrink-0` and `flex-1` to control flex sizing
- Without wrappers, projected content has no flex sizing → layout breaks

### Wrapper Component for Sidebars

When creating a wrapper component around a sidebar:

```typescript
// BAD - contents breaks height chain
@Component({
  selector: 'mcms-admin-sidebar',
  host: { class: 'contents' }, // BROKEN - sidebar won't get proper height
})

// GOOD - proper flex child
@Component({
  selector: 'mcms-admin-sidebar',
  host: { class: 'shrink-0' }, // Correct - participates in flex layout
  template: `<mcms-sidebar>...</mcms-sidebar>`,
})
```

### Full Height Layout

```typescript
// Parent shell - uses min-h-screen for overall page layout
@Component({
  host: { class: 'flex min-h-screen bg-background' },
  template: `
    <mcms-admin-sidebar />
    <main class="flex-1 overflow-auto">...</main>
  `,
})

// Sidebar wrapper - shrink-0 prevents squishing
@Component({
  host: { class: 'shrink-0' },
  template: `<mcms-sidebar>...</mcms-sidebar>`,
})

// Sidebar component - h-screen forces exact viewport height
@Component({
  host: { class: 'block' },
  template: `
    <aside class="flex flex-col h-screen sticky top-0">...</aside>
  `,
})
```

## Common Anti-Patterns to Avoid

| Anti-Pattern                         | Correct Approach                                     |
| ------------------------------------ | ---------------------------------------------------- |
| `window.innerWidth` checks           | Use `BreakpointObserver`                             |
| Manual focus management              | Use `cdkTrapFocus` or `FocusMonitor`                 |
| Custom positioning CSS               | Use `@angular/cdk/overlay`                           |
| `setTimeout` for animations          | Use `@angular/animations`                            |
| Manual ARIA management               | Use `@angular/aria` directives                       |
| `class="contents"` for wrappers      | Use `shrink-0` for flex children                     |
| `min-h-screen` on sidebar aside      | Use `h-screen` for exact viewport height             |
| `h-full` without parent height chain | Use `h-screen` directly on fixed containers          |
| ng-content without wrapper divs      | Wrap in div with flex classes (`shrink-0`, `flex-1`) |

## Debugging Layout Issues

### Dev Server Caching

Angular dev server may cache stale library code. If changes aren't appearing:

```bash
# Kill the dev server and restart
lsof -i :4200 | awk 'NR>1 {print $2}' | xargs kill -9
nx serve example-angular
```

### Diagnosing Sidebar Footer Not at Bottom

**Symptoms:** Footer appears in middle of sidebar, nav items stretch to fill space

**Root Cause Analysis:**

1. Check if aside uses `h-screen` (NOT `min-h-screen`)
2. Check if ng-content projections are wrapped in divs
3. Check if wrapper divs have proper flex classes
4. Check if parent wrapper uses `contents` (should be `shrink-0`)

**Debugging Steps:**

1. Verify height chain: parent shell → sidebar wrapper → sidebar → aside
2. Use browser DevTools to inspect computed heights at each level
3. If aside height is "auto" or 0, the height chain is broken
4. If footer div doesn't have `shrink-0`, it may grow with flex

### Visual Verification Required

Always verify layout fixes with actual browser screenshots. Dev tools can show:

- Computed dimensions of each element
- Whether flex items are shrinking/growing as expected
- Whether overflow is triggering scrollbars
