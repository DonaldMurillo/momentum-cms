import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	signal,
} from '@angular/core';
import { Avatar } from './avatar.component';

/**
 * Avatar fallback component shown when image fails to load.
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
	selector: 'mcms-avatar-fallback',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarFallback {
	private readonly avatar = inject(Avatar, { optional: true });

	/** Delay in milliseconds before showing fallback. */
	readonly delayMs = input(600);

	/** Additional CSS classes. */
	readonly class = input('');

	private readonly canRender = signal(false);

	constructor() {
		effect(() => {
			const delay = this.delayMs();
			// Reset and start timer
			this.canRender.set(false);

			if (delay === 0) {
				this.canRender.set(true);
			} else {
				const timer = setTimeout(() => this.canRender.set(true), delay);
				return () => clearTimeout(timer);
			}

			return undefined;
		});
	}

	readonly hostClasses = computed(() => {
		const imageLoaded = this.avatar?.imageLoaded() ?? false;
		const ready = this.canRender();

		// Show fallback only when image hasn't loaded and delay has passed
		const shouldShow = !imageLoaded && ready;

		const base =
			'flex h-full w-full items-center justify-center rounded-full bg-muted font-medium text-muted-foreground';
		const visibility = shouldShow ? 'flex' : 'hidden';

		return `${base} ${visibility} ${this.class()}`.trim();
	});
}
