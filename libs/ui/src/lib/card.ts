import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Card container component.
 *
 * Usage:
 * ```html
 * <mcms-card>
 *   <mcms-card-header>
 *     <mcms-card-title>Title</mcms-card-title>
 *     <mcms-card-description>Description</mcms-card-description>
 *   </mcms-card-header>
 *   <mcms-card-content>Content here</mcms-card-content>
 *   <mcms-card-footer>Footer</mcms-card-footer>
 * </mcms-card>
 * ```
 */
@Component({
	selector: 'mcms-card',
	host: {
		class: 'block',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			border-radius: 0.5rem;
			border: 1px solid hsl(var(--mcms-border));
			background-color: hsl(var(--mcms-card));
			color: hsl(var(--mcms-card-foreground));
			box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Card {}

@Component({
	selector: 'mcms-card-header',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			padding: 1.5rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardHeader {}

@Component({
	selector: 'mcms-card-title',
	host: { class: 'contents' },
	template: `
		<h2 class="card-title">
			<ng-content />
		</h2>
	`,
	styles: `
		.card-title {
			display: block;
			font-size: 1.5rem;
			font-weight: 600;
			line-height: 1;
			letter-spacing: -0.025em;
			margin: 0;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardTitle {}

@Component({
	selector: 'mcms-card-description',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			font-size: 0.875rem;
			color: hsl(var(--mcms-muted-foreground));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDescription {}

@Component({
	selector: 'mcms-card-content',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			padding: 0 1.5rem 1.5rem 1.5rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardContent {}

@Component({
	selector: 'mcms-card-footer',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: flex;
			align-items: center;
			padding: 0 1.5rem 1.5rem 1.5rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFooter {}
