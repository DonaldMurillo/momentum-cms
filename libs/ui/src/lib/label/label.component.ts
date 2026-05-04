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
				<span class="ml-1 text-muted-foreground" aria-hidden="true">·</span>
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

	/* Tighter than before: 13px / 500 weight, snug leading. The "required" mark is a
	 * subdued mid-dot, not a screaming red star — convention for editorial forms. */
	private readonly baseClasses =
		'text-sm font-medium leading-snug text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

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
