import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Avatar } from './avatar.component';

/**
 * Avatar image component.
 *
 * @example
 * ```html
 * <mcms-avatar>
 *   <mcms-avatar-image src="user.jpg" alt="User name" />
 *   <mcms-avatar-fallback>JD</mcms-avatar-fallback>
 * </mcms-avatar>
 * ```
 */
@Component({
	selector: 'mcms-avatar-image',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		<img
			[src]="src()"
			[alt]="alt()"
			class="aspect-square h-full w-full object-cover"
			(load)="onLoad()"
			(error)="onError()"
		/>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarImage {
	private readonly avatar = inject(Avatar, { optional: true });

	/** Image source URL. */
	readonly src = input.required<string>();

	/** Image alt text. */
	readonly alt = input('');

	/** Emitted when image fails to load. */
	readonly loadError = output<void>();

	readonly hostClasses = computed(() => {
		const loaded = this.avatar?.imageLoaded() ?? false;
		return loaded ? 'block' : 'hidden';
	});

	onLoad(): void {
		this.avatar?.setImageLoaded(true);
	}

	onError(): void {
		this.avatar?.setImageLoaded(false);
		this.loadError.emit();
	}
}
