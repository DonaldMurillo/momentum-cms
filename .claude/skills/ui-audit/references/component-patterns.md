# Component Patterns Reference

Required patterns for all Momentum CMS UI components.

## Signal-Based Architecture

Angular 21 uses signal-based reactivity. All components must follow:

### Inputs

```typescript
// CORRECT: Signal inputs
readonly variant = input<'primary' | 'secondary'>('primary');
readonly disabled = input(false);
readonly data = input.required<T[]>();

// INCORRECT: Decorator inputs
@Input() variant = 'primary';  // DON'T USE
```

### Outputs

```typescript
// CORRECT: Signal outputs
readonly valueChange = output<string>();
readonly clicked = output<void>();

// INCORRECT: Decorator outputs
@Output() valueChange = new EventEmitter<string>();  // DON'T USE
```

### Two-Way Binding

```typescript
// For form controls, use model()
readonly value = model(false);  // Creates [(value)] binding
readonly selectedItems = model<T[]>([]);
```

### Computed Values

```typescript
// CORRECT: Derived state with computed()
readonly hasError = computed(() => this.errors().length > 0);
readonly displayValue = computed(() => this.format(this.value()));

// INCORRECT: Getters
get hasError() { return this.errors().length > 0; }  // DON'T USE
```

### Internal State

```typescript
// Use signal() for internal state
private readonly _loading = signal(false);
readonly loading = this._loading.asReadonly();

// For mutations
this._loading.set(true);
this._loading.update(v => !v);
```

## Change Detection

All components MUST use OnPush:

```typescript
@Component({
  // ...
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

## Host Styling (No Wrapper Divs)

Angular creates a host element. Style it directly:

```typescript
// CORRECT: Host styling
@Component({
  selector: 'mcms-button',
  host: {
    '[class]': 'hostClasses()',
    '[attr.disabled]': 'disabled() || null',
  },
  template: `<ng-content />`,
})
export class Button {
  readonly hostClasses = computed(() =>
    `inline-flex items-center ${this.variantClasses()} ${this.class()}`
  );
}

// INCORRECT: Wrapper div
@Component({
  template: `
    <div class="inline-flex items-center">  <!-- DON'T DO THIS -->
      <ng-content />
    </div>
  `,
})
```

## Class Input for Customization

Always accept a `class` input for Tailwind overrides:

```typescript
@Component({
	host: { '[class]': 'hostClasses()' },
})
export class Button {
	readonly variant = input<ButtonVariant>('primary');
	readonly class = input(''); // Allow custom classes

	readonly hostClasses = computed(() => {
		const base = 'inline-flex items-center justify-center rounded-md';
		const variant = this.variantClasses();
		const custom = this.class();
		return `${base} ${variant} ${custom}`;
	});
}
```

## Naming Conventions

| Element     | Convention     | Example                       |
| ----------- | -------------- | ----------------------------- |
| Selector    | `mcms-` prefix | `mcms-button`, `mcms-card`    |
| File names  | kebab-case     | `button.component.ts`         |
| Class names | PascalCase     | `ButtonComponent` or `Button` |
| Directories | kebab-case     | `data-table/`                 |

## No Standalone Declaration

In Angular 21, `standalone: true` is the default. Don't declare it:

```typescript
// CORRECT: Omit standalone
@Component({
  selector: 'mcms-button',
  template: `...`,
})

// INCORRECT: Redundant declaration
@Component({
  selector: 'mcms-button',
  standalone: true,  // DON'T INCLUDE - it's the default
  template: `...`,
})
```

## Dependency Injection

Use `inject()` function, not constructor injection:

```typescript
// CORRECT
export class MyComponent {
	private readonly http = inject(HttpClient);
	private readonly router = inject(Router);
}

// INCORRECT
export class MyComponent {
	constructor(
		private http: HttpClient, // DON'T USE
		private router: Router,
	) {}
}
```

## Control Flow

Use built-in control flow, not structural directives:

```typescript
// CORRECT: Built-in control flow
@if (loading()) {
  <mcms-spinner />
} @else {
  @for (item of items(); track item.id) {
    <div>{{ item.name }}</div>
  }
}

// INCORRECT: Structural directives
<mcms-spinner *ngIf="loading()"></mcms-spinner>  // DON'T USE
<div *ngFor="let item of items()">...</div>       // DON'T USE
```

## Complete Example

```typescript
import {
	Component,
	ChangeDetectionStrategy,
	input,
	output,
	computed,
	signal,
	inject,
} from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
	selector: 'button[mcms-button]',
	host: {
		'[class]': 'hostClasses()',
		'[disabled]': 'disabled()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
	// Signal inputs
	readonly variant = input<ButtonVariant>('primary');
	readonly size = input<ButtonSize>('md');
	readonly disabled = input(false);
	readonly class = input('');

	// Computed host classes
	readonly hostClasses = computed(() => {
		const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors';
		const variant = this.variantClasses();
		const size = this.sizeClasses();
		const custom = this.class();
		return `${base} ${variant} ${size} ${custom}`;
	});

	private readonly variantClasses = computed(() => {
		switch (this.variant()) {
			case 'primary':
				return 'bg-primary text-primary-foreground hover:bg-primary/90';
			case 'secondary':
				return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
			case 'destructive':
				return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
		}
	});

	private readonly sizeClasses = computed(() => {
		switch (this.size()) {
			case 'sm':
				return 'h-8 px-3 text-sm';
			case 'md':
				return 'h-10 px-4 text-sm';
			case 'lg':
				return 'h-12 px-6 text-base';
		}
	});
}
```

## Audit Checklist

When auditing a component, verify:

- [ ] Uses `input()` / `input.required()` for all inputs
- [ ] Uses `output()` for all outputs
- [ ] Uses `model()` for two-way bindings
- [ ] Uses `computed()` for derived state
- [ ] Uses `signal()` for internal state
- [ ] Has `ChangeDetectionStrategy.OnPush`
- [ ] Uses host property for styling (no wrapper divs)
- [ ] Accepts `class` input for customization
- [ ] Selector has `mcms-` prefix
- [ ] Does NOT have `standalone: true`
- [ ] Uses `inject()` for DI
- [ ] Uses `@if`/`@for`/`@switch` control flow
