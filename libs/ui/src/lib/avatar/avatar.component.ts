import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { AvatarSize } from './avatar.types';
import { AVATAR_SIZE_CLASSES } from './avatar.types';

/**
 * Avatar container component.
 *
 * @example
 * ```html
 * <mcms-avatar>
 *   <mcms-avatar-image src="user.jpg" alt="User" />
 *   <mcms-avatar-fallback>JD</mcms-avatar-fallback>
 * </mcms-avatar>
 * ```
 */
@Component({
	selector: 'mcms-avatar',
	host: {
		'[class]': 'hostClasses()',
		role: 'img',
		'[attr.aria-label]': 'ariaLabel() || null',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
	/** Size of the avatar. */
	readonly size = input<AvatarSize>('md');

	/** Additional CSS classes. */
	readonly class = input('');

	/** Accessible label for the avatar. */
	readonly ariaLabel = input<string | undefined>(undefined);

	/** Internal state for image loading status. */
	readonly imageLoaded = signal(false);

	/** Set image loaded state (called by AvatarImage). */
	setImageLoaded(loaded: boolean): void {
		this.imageLoaded.set(loaded);
	}

	readonly hostClasses = computed(() => {
		const base = 'relative flex shrink-0 overflow-hidden rounded-full';
		const sizeClasses = AVATAR_SIZE_CLASSES[this.size()];
		return `${base} ${sizeClasses} ${this.class()}`.trim();
	});
}
