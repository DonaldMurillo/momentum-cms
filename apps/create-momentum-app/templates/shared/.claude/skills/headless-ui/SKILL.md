---
name: headless-ui
description: Use @momentumcms/headless inside generated Momentum apps. Use when building custom public UI, composing accessible primitives, configuring global styles for hdl-* elements, or adding app-level tests around headless interactions.
argument-hint: <feature-or-primitive>
---

# Use Headless UI In Generated Apps

Use this skill when a generated app needs custom UI built on `@momentumcms/headless`.

## Prefer Headless For

- Public-facing UI that should not look like the admin
- App-specific design systems that still need solid keyboard and ARIA behavior
- Custom menus, dialogs, comboboxes, chips, tabs, and form fields

Use `@momentumcms/admin` when you want the built-in admin screens instead of custom surfaces.

## Workflow

1. Import the needed primitive classes into the Angular component that renders them.
2. Style them from `src/styles.css` or your global Tailwind layer, not from the library.
3. Target `data-slot`, `data-state`, `data-disabled`, and overlay classes such as `.hdl-dialog-panel`.
4. Add visible state readouts for important interactions so browser tests can prove the UI intention.
5. Update app routes or showcase pages if you are adding a reusable demo surface.

## Styling Rules

- Start with design tokens in `@layer base`.
- Add shared recipes in `@layer components`.
- Use host `class=""` only for local one-off overrides.
- For projected child visuals, style the child markup you render inside the primitive.
- Keep `[hidden]` behavior intact for slots that collapse or unmount visually.

## Example Shape

```typescript
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { HdlCombobox, HdlComboboxInput, HdlComboboxPopup, HdlOption } from '@momentumcms/headless';

@Component({
	selector: 'app-filter-combobox',
	imports: [HdlCombobox, HdlComboboxInput, HdlComboboxPopup, HdlOption],
	template: `
		<hdl-combobox [value]="selected()" (valueChange)="selected.set($event)">
			<input hdlComboboxInput [value]="query()" (input)="query.set(search.value)" #search />
			<hdl-combobox-popup>
				@for (item of filteredItems(); track item) {
					<hdl-option [value]="item">{{ item }}</hdl-option>
				}
			</hdl-combobox-popup>
		</hdl-combobox>

		<p>Selected: {{ selected() || 'none' }}</p>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterComboboxComponent {
	readonly items = ['Articles', 'Pages', 'Authors', 'Media'];
	readonly query = signal('');
	readonly selected = signal('');
	readonly filteredItems = computed(() => {
		const query = this.query().trim().toLowerCase();
		return query ? this.items.filter((item) => item.toLowerCase().includes(query)) : this.items;
	});
}
```

## Test Expectations

- Unit tests should cover app-specific state mapping and conditional rendering.
- Browser tests should assert the intended behavior, not just the presence of `hdl-*` tags.
- Good assertions: combobox filtering works, menu clicks update the readout, chips remove correctly, dialog actions dismiss as expected.

## If You Need More Than Consumption

If the app task actually requires changing the library itself, switch to the repo skill for maintaining `libs/headless` instead of patching around the library from the app.
