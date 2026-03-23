import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Badge } from '@momentumcms/ui';
import type { DeepDiffResult } from '@momentumcms/core';

/**
 * Renders a single field diff with type-aware display.
 *
 * Supports inline and side-by-side view modes.
 * Handles text (word-level diff), numbers, booleans, arrays, groups, JSON, and fallback.
 */
@Component({
	selector: 'mcms-diff-field-renderer',
	imports: [Badge],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div
			class="rounded-md border border-border p-3"
			[attr.data-testid]="'diff-field-' + diff().field"
		>
			<div class="mb-2 flex items-center gap-2">
				<mcms-badge variant="outline">{{ diff().label ?? diff().field }}</mcms-badge>
				@if (diff().changeType === 'added') {
					<mcms-badge variant="default" class="text-xs" data-testid="diff-badge-added"
						>added</mcms-badge
					>
				} @else if (diff().changeType === 'removed') {
					<mcms-badge variant="destructive" class="text-xs" data-testid="diff-badge-removed"
						>removed</mcms-badge
					>
				} @else if (diff().changeType === 'changed') {
					<mcms-badge variant="secondary" class="text-xs" data-testid="diff-badge-changed"
						>changed</mcms-badge
					>
				}
			</div>

			@if (mode() === 'side-by-side') {
				<div class="grid grid-cols-[1fr_1fr] gap-2 text-sm" data-testid="diff-side-by-side">
					<div class="rounded bg-red-50 px-2 py-1 dark:bg-red-900/20" data-testid="diff-old-value">
						@if (diff().changeType !== 'added') {
							{{ formatValue(diff().oldValue) }}
						}
					</div>
					<div
						class="rounded bg-green-50 px-2 py-1 dark:bg-green-900/20"
						data-testid="diff-new-value"
					>
						@if (diff().changeType !== 'removed') {
							{{ formatValue(diff().newValue) }}
						}
					</div>
				</div>
			} @else {
				<!-- Inline mode -->
				<div class="space-y-1 text-sm" data-testid="diff-inline">
					@if (isTextDiff()) {
						<!-- Word-level diff for text fields -->
						<div class="rounded bg-muted/50 px-2 py-1" data-testid="diff-text-segments">
							@for (segment of diff().textDiff; track $index) {
								@if (segment.type === 'common') {
									<span>{{ segment.value }} </span>
								} @else if (segment.type === 'removed') {
									<del class="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{{
										segment.value
									}}</del>
									<span> </span>
								} @else if (segment.type === 'added') {
									<ins
										class="bg-green-100 text-green-800 no-underline dark:bg-green-900/30 dark:text-green-300"
										>{{ segment.value }}</ins
									>
									<span> </span>
								}
							}
						</div>
					} @else if (hasChildren()) {
						<!-- Group/nested field diffs -->
						<div class="ml-3 space-y-2 border-l-2 border-border pl-3" data-testid="diff-children">
							@for (child of diff().children; track child.field) {
								@if (child.changeType !== 'unchanged') {
									<mcms-diff-field-renderer [diff]="child" [mode]="mode()" />
								}
							}
						</div>
					} @else if (hasArrayChanges()) {
						<!-- Array item diffs -->
						<div class="space-y-2" data-testid="diff-array-changes">
							@for (item of diff().arrayChanges; track item.index) {
								<div class="rounded border border-border/50 p-2">
									<div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
										<span>Item {{ item.index }}</span>
										<mcms-badge
											[variant]="
												item.changeType === 'added'
													? 'default'
													: item.changeType === 'removed'
														? 'destructive'
														: 'secondary'
											"
											class="text-xs"
										>
											{{ item.changeType }}
										</mcms-badge>
									</div>
									@if (item.children) {
										<div class="ml-2 space-y-1">
											@for (child of item.children; track child.field) {
												@if (child.changeType !== 'unchanged') {
													<mcms-diff-field-renderer [diff]="child" [mode]="mode()" />
												}
											}
										</div>
									} @else {
										@if (item.oldValue !== undefined && item.oldValue !== null) {
											<div class="rounded bg-red-50 px-2 py-1 dark:bg-red-900/20">
												<span class="text-muted-foreground">-&nbsp;</span>
												<span class="break-all">{{ formatValue(item.oldValue) }}</span>
											</div>
										}
										@if (item.newValue !== undefined && item.newValue !== null) {
											<div class="rounded bg-green-50 px-2 py-1 dark:bg-green-900/20">
												<span class="text-muted-foreground">+&nbsp;</span>
												<span class="break-all">{{ formatValue(item.newValue) }}</span>
											</div>
										}
									}
								</div>
							}
						</div>
					} @else {
						<!-- Default: old/new blocks -->
						@if (diff().oldValue !== undefined && diff().oldValue !== null) {
							<div
								class="rounded bg-red-50 px-2 py-1 dark:bg-red-900/20"
								data-testid="diff-old-value"
							>
								<span class="text-muted-foreground">-&nbsp;</span>
								<span class="break-all">{{ formatValue(diff().oldValue) }}</span>
							</div>
						}
						@if (diff().newValue !== undefined && diff().newValue !== null) {
							<div
								class="rounded bg-green-50 px-2 py-1 dark:bg-green-900/20"
								data-testid="diff-new-value"
							>
								<span class="text-muted-foreground">+&nbsp;</span>
								<span class="break-all">{{ formatValue(diff().newValue) }}</span>
							</div>
						}
					}
				</div>
			}
		</div>
	`,
})
export class DiffFieldRendererComponent {
	readonly diff = input.required<DeepDiffResult>();
	readonly mode = input<'inline' | 'side-by-side'>('inline');

	readonly isTextDiff = computed(() => {
		const td = this.diff().textDiff;
		return !!td && td.length > 0;
	});

	readonly hasChildren = computed(() => {
		const ch = this.diff().children;
		return !!ch && ch.length > 0;
	});

	readonly hasArrayChanges = computed(() => {
		const ac = this.diff().arrayChanges;
		return !!ac && ac.length > 0;
	});

	formatValue(value: unknown): string {
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (value === null || value === undefined) return '';
		return JSON.stringify(value, null, 2);
	}
}
