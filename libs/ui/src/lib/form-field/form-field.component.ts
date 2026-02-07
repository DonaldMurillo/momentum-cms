import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Label } from '../label/label.component';
import type { ValidationError } from '../input/input.types';

/**
 * Form field wrapper that combines label, input, and error display.
 *
 * Usage:
 * ```html
 * <mcms-form-field id="email" [required]="true" [errors]="loginForm.email().errors()">
 *   <span mcmsLabel>Email Address</span>
 *   <mcms-input [formField]="loginForm.email" />
 * </mcms-form-field>
 * ```
 */
@Component({
	selector: 'mcms-form-field',
	imports: [Label],
	host: {
		class: 'block space-y-2',
		'[attr.id]': 'null', // Remove host id to prevent duplicate with inner input
	},
	template: `
		@if (hasLabel()) {
			<mcms-label [for]="id()" [required]="required()" [disabled]="disabled()">
				<ng-content select="[mcmsLabel]" />
			</mcms-label>
		}

		<ng-content />

		<p
			[id]="errorId()"
			class="text-sm min-h-5"
			[class.text-destructive]="showError()"
			[class.text-muted-foreground]="!showError() && !!hint()"
			[attr.role]="showError() ? 'alert' : null"
			[attr.aria-live]="showError() ? 'polite' : null"
		>
			@if (showError()) {
				{{ errorMessage() }}
			} @else if (hint()) {
				{{ hint() }}
			}
		</p>
	`,
	styles: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class McmsFormField {
	readonly id = input.required<string>();
	readonly required = input(false);
	readonly disabled = input(false);
	readonly errors = input<readonly ValidationError[]>([]);
	readonly hint = input<string | undefined>(undefined);
	readonly hasLabel = input(true);

	readonly errorId = computed(() => `${this.id()}-error`);

	readonly showError = computed(() => this.errors().length > 0);

	readonly errorMessage = computed(() => {
		const errs = this.errors();
		if (errs.length === 0) return null;
		// Return the first error message, or fall back to error kind
		const first = errs[0];
		return first.message ?? `Validation error: ${first.kind}`;
	});
}
