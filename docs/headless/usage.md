# Headless UI Usage

Use `@momentumcms/headless` when you need accessible interaction behavior without opting into the admin component styling.

## When To Reach For It

- Public-facing app UI that should not inherit the admin look
- App-specific design systems built on top of behavior-only primitives
- Highly customized flows where accessibility and keyboard support still need to work

Use `@momentumcms/admin` or `@momentumcms/ui` instead when you want Momentum's pre-styled admin surfaces.

## Angular Integration

Import the primitives directly into the component that renders them:

```typescript
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { HdlField, HdlInput, HdlLabel, HdlDescription } from '@momentumcms/headless';

@Component({
	selector: 'app-search-form',
	imports: [HdlField, HdlLabel, HdlDescription, HdlInput],
	template: `
		<hdl-field>
			<hdl-label>Search posts</hdl-label>
			<hdl-description>Type a title or slug.</hdl-description>
			<input hdlInput [value]="query()" (input)="query.set(search.value)" #search />
		</hdl-field>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchFormComponent {
	readonly query = signal('');
}
```

## Styling Model

- Put shared recipes in `src/styles.css` or a Tailwind `@layer components` block.
- Target primitives by `data-slot` plus normalized state attributes such as `data-state` or `data-disabled`.
- Use host `class=""` for ad hoc one-off overrides.
- For projected visuals like switch thumbs or chip remove affordances, style the children you render inside the primitive.

See [Styling](styling.md) for the full contract.

## Behavior-Driven Testing

- Unit tests in `libs/headless` should assert the host contract: slots, states, overlay classes, and keyboard behavior.
- App-level browser tests should assert user-visible outcomes such as filtered combobox results, selected menu actions, or chip removal.
- The example Angular app demonstrates this pattern at `/headless-styling-lab`.

If you add a new primitive family, update the export surface in [Overview](overview.md), add it to the styling lab, and cover it with a matching unit or browser test.
