import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Label component for form fields.
 *
 * Usage:
 * ```html
 * <mcms-label for="email" [required]="true">Email Address</mcms-label>
 * <mcms-input id="email" />
 * ```
 */
@Component({
	selector: 'mcms-label',
	host: {
		class: 'contents',
	},
	template: `
		<label [attr.for]="for()" [class]="hostClasses()">
			<ng-content />
			@if (required()) {
				<span class="text-destructive ml-1" aria-hidden="true">*</span>
			}
		</label>
	`,
	styles: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Label {
	readonly for = input<string | undefined>(undefined);
	readonly required = input(false);
	readonly disabled = input(false);
	readonly class = input('');

	private readonly baseClasses =
		'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

	readonly hostClasses = computed(() => {
		const classes = [this.baseClasses];
		if (this.disabled()) {
			classes.push('cursor-not-allowed opacity-70');
		}
		if (this.class()) {
			classes.push(this.class());
		}
		return classes.join(' ');
	});
}
