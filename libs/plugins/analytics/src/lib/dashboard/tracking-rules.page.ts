/**
 * Tracking Rules Admin Page
 *
 * Full CRUD for tracking rules: list, create, edit, toggle active, delete.
 * Uses DialogService for create/edit forms and ConfirmationService for deletes.
 * Registered as a plugin admin route at 'analytics/tracking-rules'.
 */

import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	computed,
	OnInit,
	PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Badge,
	Skeleton,
	Button,
	Switch,
	DialogService,
	DropdownMenu,
	DropdownTrigger,
	DropdownMenuItem,
	DropdownSeparator,
} from '@momentum-cms/ui';
import { ConfirmationService } from '@momentum-cms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroCursorArrowRays,
	heroArrowPath,
	heroPlus,
	heroEllipsisVertical,
} from '@ng-icons/heroicons/outline';
import { TrackingRuleFormDialog } from './tracking-rule-form.dialog';
import type { TrackingRuleEntry, TrackingRuleFormData } from './tracking-rule-form.dialog';
import { isRecord } from '../utils/type-guards';

/**
 * Parse a document from the collection API into a TrackingRuleEntry.
 */
function parseRuleEntry(doc: unknown): TrackingRuleEntry | null {
	if (!isRecord(doc)) return null;
	if (typeof doc['id'] !== 'string') return null;

	return {
		id: doc['id'],
		name: typeof doc['name'] === 'string' ? doc['name'] : '(unnamed)',
		selector: typeof doc['selector'] === 'string' ? doc['selector'] : '',
		eventType: typeof doc['eventType'] === 'string' ? doc['eventType'] : 'click',
		eventName: typeof doc['eventName'] === 'string' ? doc['eventName'] : '',
		urlPattern: typeof doc['urlPattern'] === 'string' ? doc['urlPattern'] : '*',
		active: doc['active'] === true,
		rateLimit: typeof doc['rateLimit'] === 'number' ? doc['rateLimit'] : undefined,
		properties: isRecord(doc['properties']) ? doc['properties'] : undefined,
	};
}

@Component({
	selector: 'mcms-tracking-rules-page',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Badge,
		Skeleton,
		Button,
		Switch,
		NgIcon,
		DropdownMenu,
		DropdownTrigger,
		DropdownMenuItem,
		DropdownSeparator,
	],
	providers: [provideIcons({ heroCursorArrowRays, heroArrowPath, heroPlus, heroEllipsisVertical })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-4xl font-bold tracking-tight text-foreground">Tracking Rules</h1>
					<p class="text-muted-foreground mt-3 text-lg">
						Manage CSS selector-based event tracking rules
					</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						mcms-button
						variant="outline"
						size="sm"
						(click)="refresh()"
						ariaLabel="Refresh tracking rules"
					>
						<ng-icon name="heroArrowPath" size="16" aria-hidden="true" />
						Refresh
					</button>
					<button mcms-button size="sm" (click)="openCreateDialog()" ariaLabel="New Rule">
						<ng-icon name="heroPlus" size="16" aria-hidden="true" />
						New Rule
					</button>
				</div>
			</div>
		</header>

		<!-- Summary Cards -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
			<mcms-card>
				<mcms-card-header>
					<div class="flex items-center justify-between">
						<mcms-card-description>Total Rules</mcms-card-description>
						<ng-icon
							name="heroCursorArrowRays"
							class="text-muted-foreground"
							size="20"
							aria-hidden="true"
						/>
					</div>
					<mcms-card-title>
						<span class="text-3xl font-bold">{{ totalRules() }}</span>
					</mcms-card-title>
				</mcms-card-header>
			</mcms-card>
			<mcms-card>
				<mcms-card-header>
					<mcms-card-description>Active</mcms-card-description>
					<mcms-card-title>
						<span class="text-3xl font-bold text-emerald-600">{{ activeRules() }}</span>
					</mcms-card-title>
				</mcms-card-header>
			</mcms-card>
			<mcms-card>
				<mcms-card-header>
					<mcms-card-description>Inactive</mcms-card-description>
					<mcms-card-title>
						<span class="text-3xl font-bold text-muted-foreground">{{ inactiveRules() }}</span>
					</mcms-card-title>
				</mcms-card-header>
			</mcms-card>
		</div>

		<!-- Rules Table -->
		@if (loading() && rules().length === 0) {
			<div class="space-y-3">
				@for (i of [1, 2, 3]; track i) {
					<mcms-skeleton class="h-14 w-full" />
				}
			</div>
		} @else if (rules().length > 0) {
			<div class="border border-border rounded-lg overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm" role="table">
						<thead>
							<tr class="border-b border-border bg-muted/50">
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
									Name
								</th>
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
									Selector
								</th>
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
									Event
								</th>
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
									URL Pattern
								</th>
								<th scope="col" class="px-4 py-3 text-center font-medium text-muted-foreground">
									Active
								</th>
								<th scope="col" class="px-4 py-3 text-right font-medium text-muted-foreground">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							@for (rule of rules(); track rule.id) {
								<tr
									class="border-b border-border last:border-0 hover:bg-muted/30
										transition-colors"
								>
									<td class="px-4 py-3 font-medium text-foreground">
										{{ rule.name }}
									</td>
									<td
										class="px-4 py-3 font-mono text-xs text-muted-foreground max-w-48 truncate"
										[title]="rule.selector"
									>
										{{ rule.selector }}
									</td>
									<td class="px-4 py-3">
										<mcms-badge variant="outline">{{ rule.eventType }}</mcms-badge>
										<span class="text-muted-foreground ml-1">→</span>
										<span class="ml-1 text-foreground">{{ rule.eventName }}</span>
									</td>
									<td class="px-4 py-3 text-muted-foreground">
										{{ rule.urlPattern }}
									</td>
									<td class="px-4 py-3 text-center">
										<mcms-switch
											[value]="rule.active"
											(valueChange)="toggleActive(rule)"
											ariaLabel="Toggle active"
										/>
									</td>
									<td class="px-4 py-3 text-right">
										<button
											mcms-button
											variant="ghost"
											size="icon"
											[mcmsDropdownTrigger]="ruleMenu"
											ariaLabel="Rule actions"
										>
											<ng-icon name="heroEllipsisVertical" size="16" aria-hidden="true" />
										</button>
										<ng-template #ruleMenu>
											<mcms-dropdown-menu>
												<button mcms-dropdown-item value="edit" (selected)="openEditDialog(rule)">
													Edit
												</button>
												<mcms-dropdown-separator />
												<button mcms-dropdown-item value="delete" (selected)="deleteRule(rule)">
													Delete
												</button>
											</mcms-dropdown-menu>
										</ng-template>
									</td>
								</tr>
							}
						</tbody>
					</table>
				</div>
			</div>
		} @else {
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<ng-icon
					name="heroCursorArrowRays"
					class="text-muted-foreground mb-4"
					size="40"
					aria-hidden="true"
				/>
				<p class="text-foreground font-medium">No tracking rules defined</p>
				<p class="text-sm text-muted-foreground mt-1 mb-6">
					Create your first tracking rule to start tracking element interactions
				</p>
				<button mcms-button size="sm" (click)="openCreateDialog()">
					<ng-icon name="heroPlus" size="16" aria-hidden="true" />
					New Rule
				</button>
			</div>
		}
	`,
})
export class TrackingRulesPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly dialog = inject(DialogService);
	private readonly confirmation = inject(ConfirmationService);

	readonly loading = signal(false);
	readonly rules = signal<TrackingRuleEntry[]>([]);

	readonly totalRules = computed((): number => this.rules().length);
	readonly activeRules = computed((): number => this.rules().filter((r) => r.active).length);
	readonly inactiveRules = computed((): number => this.rules().filter((r) => !r.active).length);

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		void this.fetchRules();
	}

	refresh(): void {
		void this.fetchRules();
	}

	openCreateDialog(): void {
		const data: TrackingRuleFormData = { mode: 'create' };
		const ref = this.dialog.open(TrackingRuleFormDialog, { data, width: '32rem' });

		ref.afterClosed.subscribe((result) => {
			if (result === 'saved') void this.fetchRules();
		});
	}

	openEditDialog(rule: TrackingRuleEntry): void {
		const data: TrackingRuleFormData = { mode: 'edit', rule };
		const ref = this.dialog.open(TrackingRuleFormDialog, { data, width: '32rem' });

		ref.afterClosed.subscribe((result) => {
			if (result === 'saved') void this.fetchRules();
		});
	}

	async toggleActive(rule: TrackingRuleEntry): Promise<void> {
		if (!isPlatformBrowser(this.platformId)) return;

		const newActive = !rule.active;

		// Optimistic update
		this.rules.update((rules) =>
			rules.map((r) => (r.id === rule.id ? { ...r, active: newActive } : r)),
		);

		try {
			await fetch(`/api/tracking-rules/${rule.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ active: newActive }),
			});
		} catch {
			// Revert on error
			this.rules.update((rules) =>
				rules.map((r) => (r.id === rule.id ? { ...r, active: rule.active } : r)),
			);
		}
	}

	async deleteRule(rule: TrackingRuleEntry): Promise<void> {
		if (!isPlatformBrowser(this.platformId)) return;

		const confirmed = await this.confirmation.delete(rule.name);
		if (!confirmed) return;

		try {
			await fetch(`/api/tracking-rules/${rule.id}`, { method: 'DELETE' });
			void this.fetchRules();
		} catch {
			// Silently fail — user can retry
		}
	}

	private async fetchRules(): Promise<void> {
		this.loading.set(true);
		try {
			const res = await fetch('/api/tracking-rules?limit=100');
			if (!res.ok) return;

			const data: unknown = await res.json();
			if (!isRecord(data) || !Array.isArray(data['docs'])) return;

			const entries = data['docs']
				.map(parseRuleEntry)
				.filter((entry): entry is TrackingRuleEntry => entry != null);

			this.rules.set(entries);
		} catch {
			// Silently fail — page shows empty state
		} finally {
			this.loading.set(false);
		}
	}
}
