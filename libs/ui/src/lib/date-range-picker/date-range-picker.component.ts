import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	OnDestroy,
	output,
	signal,
	TemplateRef,
	viewChild,
	ViewContainerRef,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { A11yModule } from '@angular/cdk/a11y';
import { HdlCalendar, type DateRange } from '@momentumcms/headless';
import { getPopoverPositions } from '../popover/popover.utils';
import type { DateRangeValue } from './date-range-picker.types';

@Component({
	selector: 'mcms-date-range-picker',
	imports: [HdlCalendar, A11yModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'inline-block relative',
	},
	template: `
		<button
			type="button"
			data-slot="trigger"
			(click)="toggle()"
			[attr.aria-expanded]="isOpen()"
			aria-haspopup="dialog"
			class="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--mcms-border))] bg-[hsl(var(--mcms-card))] px-3 py-2 text-sm text-[hsl(var(--mcms-card-foreground))] hover:bg-[hsl(var(--mcms-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--mcms-ring))] focus-visible:ring-offset-2 transition-colors"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
				<line x1="16" x2="16" y1="2" y2="6" />
				<line x1="8" x2="8" y1="2" y2="6" />
				<line x1="3" x2="21" y1="10" y2="10" />
			</svg>
			<span data-slot="label">{{ displayLabel() }}</span>
		</button>

		<ng-template #calendarPopover>
			<div
				cdkTrapFocus
				cdkTrapFocusAutoCapture
				role="dialog"
				aria-modal="true"
				[attr.aria-label]="'Date range picker'"
				class="rounded-md border border-[hsl(var(--mcms-border))] bg-[hsl(var(--mcms-card))] p-3 shadow-lg"
				(keydown.escape)="close(); $event.stopPropagation()"
			>
				<hdl-calendar
					[mode]="'range'"
					(rangeSelected)="onRangeSelected($event)"
					class="block text-[hsl(var(--mcms-card-foreground))]
						[&_[data-slot=header]]:flex [&_[data-slot=header]]:items-center [&_[data-slot=header]]:justify-between [&_[data-slot=header]]:mb-2
						[&_[data-slot=prev-month]]:inline-flex [&_[data-slot=prev-month]]:items-center [&_[data-slot=prev-month]]:justify-center [&_[data-slot=prev-month]]:h-7 [&_[data-slot=prev-month]]:w-7 [&_[data-slot=prev-month]]:rounded-md [&_[data-slot=prev-month]]:border [&_[data-slot=prev-month]]:border-[hsl(var(--mcms-border))] [&_[data-slot=prev-month]]:bg-transparent [&_[data-slot=prev-month]]:hover:bg-[hsl(var(--mcms-accent))] [&_[data-slot=prev-month]]:transition-colors
						[&_[data-slot=next-month]]:inline-flex [&_[data-slot=next-month]]:items-center [&_[data-slot=next-month]]:justify-center [&_[data-slot=next-month]]:h-7 [&_[data-slot=next-month]]:w-7 [&_[data-slot=next-month]]:rounded-md [&_[data-slot=next-month]]:border [&_[data-slot=next-month]]:border-[hsl(var(--mcms-border))] [&_[data-slot=next-month]]:bg-transparent [&_[data-slot=next-month]]:hover:bg-[hsl(var(--mcms-accent))] [&_[data-slot=next-month]]:transition-colors
						[&_[data-slot=month-label]]:text-sm [&_[data-slot=month-label]]:font-medium
						[&_[data-slot=grid]]:w-full [&_[data-slot=grid]]:border-collapse
						[&_[data-slot=weekday]]:text-xs [&_[data-slot=weekday]]:text-[hsl(var(--mcms-muted-foreground))] [&_[data-slot=weekday]]:font-normal [&_[data-slot=weekday]]:h-8 [&_[data-slot=weekday]]:w-8 [&_[data-slot=weekday]]:text-center
						[&_[data-slot=day]]:text-center [&_[data-slot=day]]:text-sm [&_[data-slot=day]]:h-8 [&_[data-slot=day]]:w-8 [&_[data-slot=day]]:cursor-pointer [&_[data-slot=day]]:rounded-md [&_[data-slot=day]]:transition-colors
						[&_[data-slot=day]:hover]:bg-[hsl(var(--mcms-accent))]
						[&_[data-slot=day][aria-selected=true]]:bg-[hsl(var(--mcms-primary))] [&_[data-slot=day][aria-selected=true]]:text-[hsl(var(--mcms-primary-foreground))]
						[&_[data-slot=day][data-in-range]]:bg-[hsl(var(--mcms-primary)/0.1)]
						[&_[data-slot=day][data-today]]:font-bold [&_[data-slot=day][data-today]]:underline
						[&_[data-slot=day][data-outside-month]]:text-[hsl(var(--mcms-muted-foreground))] [&_[data-slot=day][data-outside-month]]:pointer-events-none
						[&_[data-slot=day][data-focused]]:ring-2 [&_[data-slot=day][data-focused]]:ring-[hsl(var(--mcms-ring))]"
				/>
			</div>
		</ng-template>
	`,
})
export class DateRangePicker implements OnDestroy {
	readonly placeholder = input('Select date range');
	readonly value = input<DateRangeValue | null>(null);
	readonly disabled = input(false);

	readonly rangeSelected = output<DateRangeValue>();
	readonly opened = output<void>();
	readonly closed = output<void>();

	readonly isOpen = signal(false);
	private readonly range = signal<DateRangeValue>({ start: null, end: null });

	private readonly calendarPopover = viewChild.required<TemplateRef<unknown>>('calendarPopover');

	readonly displayLabel = computed(() => {
		const r = this.range();
		if (r.start && r.end) {
			const fmt = (d: Date): string =>
				d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			return `${fmt(r.start)} – ${fmt(r.end)}`;
		}
		if (r.start) {
			return (
				r.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
				' – ...'
			);
		}
		return this.placeholder();
	});

	private readonly overlay = inject(Overlay);
	private readonly elementRef = inject(ElementRef<HTMLElement>);
	private readonly viewContainerRef = inject(ViewContainerRef);
	private overlayRef: OverlayRef | null = null;

	private readonly valueSync = effect(() => {
		const v = this.value();
		if (v) {
			this.range.set(v);
		}
	});

	toggle(): void {
		if (this.disabled()) return;
		if (this.isOpen()) {
			this.close();
		} else {
			this.open();
		}
	}

	open(): void {
		if (this.disabled() || this.isOpen()) return;
		this.createOverlay();
		this.isOpen.set(true);
		this.opened.emit();
	}

	close(): void {
		if (this.overlayRef) {
			this.overlayRef.dispose();
			this.overlayRef = null;
		}
		this.isOpen.set(false);
		this.closed.emit();
	}

	onRangeSelected(dateRange: DateRange): void {
		const value: DateRangeValue = { start: dateRange.start, end: dateRange.end };
		this.range.set(value);
		this.rangeSelected.emit(value);
		this.close();
	}

	ngOnDestroy(): void {
		this.close();
	}

	private createOverlay(): void {
		const positions = getPopoverPositions('bottom', 'start', 4);
		const positionStrategy = this.overlay
			.position()
			.flexibleConnectedTo(this.elementRef)
			.withPositions(positions)
			.withPush(true);

		this.overlayRef = this.overlay.create({
			positionStrategy,
			scrollStrategy: this.overlay.scrollStrategies.reposition(),
			hasBackdrop: true,
			backdropClass: 'cdk-overlay-transparent-backdrop',
		});

		this.overlayRef.backdropClick().subscribe(() => this.close());
		this.overlayRef.keydownEvents().subscribe((event) => {
			if (event.key === 'Escape') {
				this.close();
				this.elementRef.nativeElement.querySelector('button')?.focus();
			}
		});

		const portal = new TemplatePortal(this.calendarPopover(), this.viewContainerRef);
		this.overlayRef.attach(portal);
	}
}
