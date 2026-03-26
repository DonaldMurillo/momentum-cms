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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCalendarDays } from '@ng-icons/heroicons/outline';
import { HdlCalendar, type DateRange } from '@momentumcms/headless';
import { getPopoverPositions } from '../popover/popover.utils';
import type { DateRangeValue } from './date-range-picker.types';

@Component({
	selector: 'mcms-date-range-picker',
	imports: [HdlCalendar, A11yModule, NgIcon],
	providers: [provideIcons({ heroCalendarDays })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[class]': 'hostClasses()',
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
			<ng-icon name="heroCalendarDays" size="16" />
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
					#calendarRef
					[mode]="'range'"
					(rangeSelected)="onRangeSelected($event)"
					class="block text-[hsl(var(--mcms-card-foreground))]"
				>
					<div class="flex items-center justify-between mb-2" data-slot="header">
						<button
							type="button"
							class="inline-flex items-center justify-center h-7 w-7 rounded-md border border-[hsl(var(--mcms-border))] bg-transparent hover:bg-[hsl(var(--mcms-accent))] transition-colors"
							[attr.aria-label]="'Previous month'"
							(click)="calendarRef.prevMonth()"
						>&#8249;</button>
						<span class="text-sm font-medium" aria-live="polite">{{ calendarRef.monthLabel() }}</span>
						<button
							type="button"
							class="inline-flex items-center justify-center h-7 w-7 rounded-md border border-[hsl(var(--mcms-border))] bg-transparent hover:bg-[hsl(var(--mcms-accent))] transition-colors"
							[attr.aria-label]="'Next month'"
							(click)="calendarRef.nextMonth()"
						>&#8250;</button>
					</div>
					<table role="grid" class="w-full border-collapse" [attr.aria-label]="calendarRef.monthLabel()">
						<thead>
							<tr>
								@for (day of calendarRef.weekDays; track day) {
									<th scope="col" [attr.aria-label]="day" class="text-xs text-[hsl(var(--mcms-muted-foreground))] font-normal h-8 w-8 text-center">
										{{ day.slice(0, 2) }}
									</th>
								}
							</tr>
						</thead>
						<tbody>
							@for (week of calendarRef.weeks(); track $index) {
								<tr>
									@for (day of week; track day?.toISOString() ?? $index) {
										<td
											role="gridcell"
											class="text-center text-sm h-8 w-8 cursor-pointer rounded-md transition-colors"
											[class.bg-[hsl(var(--mcms-primary))]]="calendarRef.isSelected(day)"
											[class.text-[hsl(var(--mcms-primary-foreground))]]="calendarRef.isSelected(day)"
											[class.bg-[hsl(var(--mcms-primary)/0.1)]]="calendarRef.isInRange(day)"
											[class.font-bold]="calendarRef.isToday(day)"
											[class.underline]="calendarRef.isToday(day)"
											[class.text-[hsl(var(--mcms-muted-foreground))]]="!day"
											[class.pointer-events-none]="!day"
											[class.ring-2]="calendarRef.isFocused(day)"
											[class.ring-[hsl(var(--mcms-ring))]]="calendarRef.isFocused(day)"
											[class.hover:bg-[hsl(var(--mcms-accent))]]="!!day && !calendarRef.isSelected(day)"
											[attr.aria-selected]="calendarRef.isSelected(day) ? 'true' : null"
											[attr.aria-disabled]="!day ? 'true' : null"
											[tabindex]="calendarRef.isFocused(day) ? 0 : -1"
											(click)="day && calendarRef.selectDay(day)"
											(focus)="day && calendarRef.setFocusedDate(day)"
										>
											@if (day) {
												{{ day.getDate() }}
											}
										</td>
									}
								</tr>
							}
						</tbody>
					</table>
				</hdl-calendar>
			</div>
		</ng-template>
	`,
})
export class DateRangePicker implements OnDestroy {
	readonly class = input('');
	readonly hostClasses = computed(() => `inline-block relative ${this.class()}`.trim());

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
