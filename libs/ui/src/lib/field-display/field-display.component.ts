import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FieldDisplayType, FieldDisplayBadgeConfig } from './field-display.types';
import { Badge } from '../badge/badge.component';

/**
 * A read-only display component for rendering values with type-aware formatting.
 *
 * @example
 * ```html
 * <mcms-field-display [value]="user.name" type="text" label="Name" />
 * <mcms-field-display [value]="user.createdAt" type="date" label="Created" />
 * <mcms-field-display [value]="user.status" type="badge" [badgeConfig]="statusConfig" />
 * ```
 */
@Component({
	selector: 'mcms-field-display',
	imports: [Badge],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		@if (label()) {
			<div class="text-sm font-medium text-muted-foreground mb-1">{{ label() }}</div>
		}
		<div class="text-sm">
			@switch (type()) {
				@case ('text') {
					<span>{{ displayValue() }}</span>
				}
				@case ('number') {
					<span>{{ formattedNumber() }}</span>
				}
				@case ('date') {
					<span>{{ formattedDate() }}</span>
				}
				@case ('datetime') {
					<span>{{ formattedDateTime() }}</span>
				}
				@case ('boolean') {
					<span class="inline-flex items-center gap-1">
						@if (booleanValue()) {
							<svg
								aria-hidden="true"
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="text-green-600"
							>
								<path d="M20 6 9 17l-5-5" />
							</svg>
							<span>Yes</span>
						} @else {
							<svg
								aria-hidden="true"
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="text-muted-foreground"
							>
								<path d="M18 6 6 18" />
								<path d="m6 6 12 12" />
							</svg>
							<span>No</span>
						}
					</span>
				}
				@case ('badge') {
					@if (isEmpty()) {
						<span class="text-muted-foreground">{{ emptyText() }}</span>
					} @else {
						<mcms-badge [variant]="badgeVariant()">{{ displayValue() }}</mcms-badge>
					}
				}
				@case ('link') {
					@if (isEmpty()) {
						<span class="text-muted-foreground">{{ emptyText() }}</span>
					} @else {
						<a
							[href]="stringValue()"
							class="text-primary hover:underline"
							[attr.target]="openInNewTab() ? '_blank' : null"
							[attr.rel]="openInNewTab() ? 'noopener noreferrer' : null"
						>
							{{ displayValue() }}
						</a>
					}
				}
				@case ('email') {
					@if (isEmpty()) {
						<span class="text-muted-foreground">{{ emptyText() }}</span>
					} @else {
						<a [href]="'mailto:' + stringValue()" class="text-primary hover:underline">
							{{ displayValue() }}
						</a>
					}
				}
				@case ('list') {
					@if (isEmpty()) {
						<span class="text-muted-foreground">{{ emptyText() }}</span>
					} @else {
						<ul class="list-disc list-inside">
							@for (item of displayList(); track $index) {
								<li>{{ item }}</li>
							}
						</ul>
						@if (hasMoreItems()) {
							<span class="text-muted-foreground text-xs"> +{{ remainingItems() }} more </span>
						}
					}
				}
				@case ('json') {
					@if (isEmpty()) {
						<span class="text-muted-foreground">{{ emptyText() }}</span>
					} @else {
						<pre class="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40">{{
							formattedJson()
						}}</pre>
					}
				}
				@default {
					<span>{{ displayValue() }}</span>
				}
			}
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldDisplay {
	/** The value to display. */
	readonly value = input.required<unknown>();

	/** The type of display formatting to use. */
	readonly type = input<FieldDisplayType>('text');

	/** Optional label shown above the value. */
	readonly label = input<string | undefined>(undefined);

	/** Format string for dates. */
	readonly format = input<string | undefined>(undefined);

	/** Text to show when value is empty/null/undefined. */
	readonly emptyText = input('-');

	/** Badge configuration for type='badge'. */
	readonly badgeConfig = input<FieldDisplayBadgeConfig | undefined>(undefined);

	/** Whether to open links in new tab. */
	readonly openInNewTab = input(true);

	/** Maximum items to show for list type. */
	readonly maxItems = input(5);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base = 'block';
		return `${base} ${this.class()}`.trim();
	});

	readonly isEmpty = computed(() => {
		const val = this.value();
		if (val === null || val === undefined) return true;
		if (typeof val === 'string' && val.trim() === '') return true;
		if (Array.isArray(val) && val.length === 0) return true;
		return false;
	});

	readonly displayValue = computed(() => {
		if (this.isEmpty()) return this.emptyText();
		const val = this.value();
		return String(val);
	});

	readonly stringValue = computed(() => {
		const val = this.value();
		return typeof val === 'string' ? val : String(val ?? '');
	});

	readonly booleanValue = computed(() => {
		const val = this.value();
		return Boolean(val);
	});

	readonly formattedNumber = computed(() => {
		if (this.isEmpty()) return this.emptyText();
		const val = this.value();
		const num = typeof val === 'number' ? val : parseFloat(String(val));
		if (isNaN(num)) return this.emptyText();
		return num.toLocaleString();
	});

	readonly formattedDate = computed(() => {
		if (this.isEmpty()) return this.emptyText();
		const val = this.value();
		const date = val instanceof Date ? val : new Date(String(val));
		if (isNaN(date.getTime())) return this.emptyText();
		return date.toLocaleDateString();
	});

	readonly formattedDateTime = computed(() => {
		if (this.isEmpty()) return this.emptyText();
		const val = this.value();
		const date = val instanceof Date ? val : new Date(String(val));
		if (isNaN(date.getTime())) return this.emptyText();
		return date.toLocaleString();
	});

	readonly formattedJson = computed(() => {
		if (this.isEmpty()) return '';
		try {
			return JSON.stringify(this.value(), null, 2);
		} catch {
			return String(this.value());
		}
	});

	readonly badgeVariant = computed(() => {
		const config = this.badgeConfig();
		const val = String(this.value() ?? '').toLowerCase();

		if (config?.variants?.[val]) {
			return config.variants[val];
		}

		// Common status mappings
		if (['active', 'success', 'completed', 'approved', 'yes', 'true'].includes(val)) {
			return 'success';
		}
		if (['inactive', 'error', 'failed', 'rejected', 'no', 'false'].includes(val)) {
			return 'destructive';
		}
		if (['pending', 'warning', 'review', 'draft'].includes(val)) {
			return 'warning';
		}

		return config?.defaultVariant ?? 'default';
	});

	readonly listValue = computed<unknown[]>(() => {
		const val = this.value();
		if (Array.isArray(val)) return val;
		if (typeof val === 'string') return val.split(',').map((s) => s.trim());
		return [];
	});

	readonly displayList = computed(() => {
		return this.listValue().slice(0, this.maxItems());
	});

	readonly hasMoreItems = computed(() => {
		return this.listValue().length > this.maxItems();
	});

	readonly remainingItems = computed(() => {
		return this.listValue().length - this.maxItems();
	});
}
