/**
 * Robots Settings Admin Page
 *
 * Edit robots.txt rules, crawl delay, and additional sitemaps.
 * Reads/writes via the `/api/seo/seo-settings` endpoint.
 * Registered as a plugin admin route at 'seo/robots'.
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
} from '@momentumcms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroDocumentText,
	heroArrowPath,
	heroPlusCircle,
	heroTrash,
} from '@ng-icons/heroicons/outline';
import { generateRobotsTxt } from './robots-txt-generator';

interface RobotsRule {
	userAgent: string;
	allow: string[];
	disallow: string[];
}

interface SeoSettingsResponse {
	robotsRules?: RobotsRule[];
	robotsCrawlDelay?: number | null;
	robotsAdditionalSitemaps?: string[];
	id?: string;
}

@Component({
	selector: 'mcms-robots-settings-page',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Badge,
		Skeleton,
		Button,
		NgIcon,
	],
	providers: [provideIcons({ heroDocumentText, heroArrowPath, heroPlusCircle, heroTrash })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-4xl font-bold tracking-tight text-foreground">Robots</h1>
					<p class="text-muted-foreground mt-3 text-lg">
						Configure robots.txt rules for search engine crawlers
					</p>
				</div>
				<div class="flex gap-2">
					<button
						mcms-button
						variant="outline"
						size="sm"
						(click)="refresh()"
						ariaLabel="Refresh robots settings"
					>
						<ng-icon name="heroArrowPath" size="16" aria-hidden="true" />
						Refresh
					</button>
					<button
						mcms-button
						size="sm"
						(click)="save()"
						[disabled]="saving()"
						ariaLabel="Save robots settings"
					>
						{{ saving() ? 'Saving...' : 'Save' }}
					</button>
				</div>
			</div>
		</header>

		@if (loading() && rules().length === 0) {
			<div class="space-y-4" aria-busy="true">
				@for (i of [1, 2, 3]; track i) {
					<mcms-skeleton class="h-20 w-full" />
				}
			</div>
		} @else {
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				<!-- Rules Section -->
				<div class="space-y-6">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
							Rules
						</h2>
						<button
							mcms-button
							variant="outline"
							size="sm"
							(click)="addRule()"
							ariaLabel="Add new rule"
						>
							<ng-icon name="heroPlusCircle" size="16" aria-hidden="true" />
							Add Rule
						</button>
					</div>

					@for (rule of rules(); track $index; let i = $index) {
						<mcms-card>
							<mcms-card-header>
								<div class="flex items-center justify-between">
									<mcms-card-title class="text-base">Rule {{ i + 1 }}</mcms-card-title>
									@if (rules().length > 1) {
										<button
											mcms-button
											variant="ghost"
											size="sm"
											(click)="removeRule(i)"
											ariaLabel="Remove rule"
										>
											<ng-icon
												name="heroTrash"
												size="16"
												class="text-destructive"
												aria-hidden="true"
											/>
										</button>
									}
								</div>
							</mcms-card-header>
							<mcms-card-content>
								<div class="space-y-3">
									<div>
										<label
											[attr.for]="'user-agent-' + i"
											class="text-sm font-medium text-foreground block mb-1"
											>User-Agent</label
										>
										<input
											type="text"
											[id]="'user-agent-' + i"
											class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
												focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											[value]="rule.userAgent"
											(input)="updateRuleField(i, 'userAgent', $event)"
											placeholder="*"
										/>
									</div>
									<div>
										<label
											[attr.for]="'allow-' + i"
											class="text-sm font-medium text-foreground block mb-1"
											>Allow (one per line)</label
										>
										<textarea
											[id]="'allow-' + i"
											class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono
												focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											rows="2"
											[value]="rule.allow.join('\\n')"
											(input)="updateRulePathField(i, 'allow', $event)"
											placeholder="/
/public"
										></textarea>
									</div>
									<div>
										<label
											[attr.for]="'disallow-' + i"
											class="text-sm font-medium text-foreground block mb-1"
											>Disallow (one per line)</label
										>
										<textarea
											[id]="'disallow-' + i"
											class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono
												focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											rows="2"
											[value]="rule.disallow.join('\\n')"
											(input)="updateRulePathField(i, 'disallow', $event)"
											placeholder="/admin
/api"
										></textarea>
									</div>
								</div>
							</mcms-card-content>
						</mcms-card>
					}

					<!-- Crawl Delay -->
					<mcms-card>
						<mcms-card-header>
							<mcms-card-title class="text-base">Crawl Delay</mcms-card-title>
							<mcms-card-description
								>Seconds between successive requests (optional)</mcms-card-description
							>
						</mcms-card-header>
						<mcms-card-content>
							<label for="crawl-delay" class="sr-only">Crawl Delay</label>
							<input
								type="number"
								id="crawl-delay"
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
									focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								[value]="crawlDelay()"
								(input)="updateCrawlDelay($event)"
								min="0"
								placeholder="Not set"
							/>
						</mcms-card-content>
					</mcms-card>

					<!-- Additional Sitemaps -->
					<mcms-card>
						<mcms-card-header>
							<mcms-card-title class="text-base">Additional Sitemaps</mcms-card-title>
							<mcms-card-description
								>Extra sitemap URLs to include (one per line)</mcms-card-description
							>
						</mcms-card-header>
						<mcms-card-content>
							<label for="additional-sitemaps" class="sr-only">Additional Sitemaps</label>
							<textarea
								id="additional-sitemaps"
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono
									focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								rows="3"
								[value]="additionalSitemaps().join('\\n')"
								(input)="updateAdditionalSitemaps($event)"
								placeholder="https://example.com/extra-sitemap.xml"
							></textarea>
						</mcms-card-content>
					</mcms-card>
				</div>

				<!-- Preview Section -->
				<div>
					<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
						Preview
					</h2>
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-title class="text-base">robots.txt</mcms-card-title>
								<mcms-badge variant="outline">Preview</mcms-badge>
							</div>
						</mcms-card-header>
						<mcms-card-content>
							<pre
								class="text-sm font-mono bg-muted/50 rounded-md p-4 overflow-x-auto whitespace-pre-wrap"
								>{{ preview() }}</pre
							>
						</mcms-card-content>
					</mcms-card>
				</div>
			</div>
		}

		<!-- Success/Error messages -->
		@if (saveSuccess()) {
			<div
				class="mt-6 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm"
			>
				Settings saved successfully
			</div>
		}
		@if (error(); as err) {
			<mcms-card role="alert" class="mt-6">
				<mcms-card-header>
					<mcms-card-title>Error</mcms-card-title>
					<mcms-card-description>{{ err }}</mcms-card-description>
				</mcms-card-header>
				<mcms-card-content>
					<button
						class="text-sm text-primary hover:underline focus-visible:outline-none
							focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
						(click)="refresh()"
					>
						Try again
					</button>
				</mcms-card-content>
			</mcms-card>
		}
	`,
})
export class RobotsSettingsPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);

	readonly loading = signal(false);
	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly saveSuccess = signal(false);

	readonly rules = signal<RobotsRule[]>([{ userAgent: '*', allow: ['/'], disallow: [] }]);
	readonly crawlDelay = signal<string>('');
	readonly additionalSitemaps = signal<string[]>([]);

	readonly preview = computed((): string => {
		const config = {
			rules: this.rules(),
			crawlDelay: this.crawlDelay() ? Number(this.crawlDelay()) : undefined,
			additionalSitemaps: this.additionalSitemaps().filter((s) => s.length > 0),
		};
		// Use empty siteUrl in preview — the actual siteUrl is applied server-side
		return generateRobotsTxt('', config);
	});

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		void this.fetchSettings();
	}

	refresh(): void {
		void this.fetchSettings();
	}

	addRule(): void {
		this.rules.update((list) => [...list, { userAgent: '*', allow: [], disallow: [] }]);
	}

	removeRule(index: number): void {
		this.rules.update((list) => list.filter((_, i) => i !== index));
	}

	updateRuleField(index: number, field: 'userAgent', event: Event): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DOM event target
		const value = (event.target as HTMLInputElement).value;
		this.rules.update((list) => list.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
	}

	updateRulePathField(index: number, field: 'allow' | 'disallow', event: Event): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DOM event target
		const value = (event.target as HTMLTextAreaElement).value;
		const paths = value.split('\n').filter((p) => p.length > 0);
		this.rules.update((list) => list.map((r, i) => (i === index ? { ...r, [field]: paths } : r)));
	}

	updateCrawlDelay(event: Event): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DOM event target
		this.crawlDelay.set((event.target as HTMLInputElement).value);
	}

	updateAdditionalSitemaps(event: Event): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DOM event target
		const value = (event.target as HTMLTextAreaElement).value;
		this.additionalSitemaps.set(value.split('\n'));
	}

	async save(): Promise<void> {
		if (!isPlatformBrowser(this.platformId)) return;
		this.saving.set(true);
		this.error.set(null);
		this.saveSuccess.set(false);

		try {
			const body = {
				robotsRules: this.rules(),
				robotsCrawlDelay: this.crawlDelay() ? Number(this.crawlDelay()) : null,
				robotsAdditionalSitemaps: this.additionalSitemaps().filter((s) => s.length > 0),
			};

			const res = await fetch('/api/seo/seo-settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				this.error.set(`HTTP ${res.status}`);
				return;
			}

			this.saveSuccess.set(true);
			// eslint-disable-next-line local/no-direct-browser-apis -- Plugin dashboard, browser-only context
			setTimeout(() => this.saveSuccess.set(false), 3000);
		} catch {
			this.error.set('Failed to save settings');
		} finally {
			this.saving.set(false);
		}
	}

	private async fetchSettings(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);
		try {
			const res = await fetch('/api/seo/seo-settings');
			if (!res.ok) {
				this.error.set(`HTTP ${res.status}`);
				return;
			}

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fetch JSON response typing
			const data = (await res.json()) as SeoSettingsResponse;

			if (data.robotsRules && Array.isArray(data.robotsRules) && data.robotsRules.length > 0) {
				this.rules.set(
					data.robotsRules.map((r) => ({
						userAgent: r.userAgent ?? '*',
						allow: Array.isArray(r.allow) ? r.allow : [],
						disallow: Array.isArray(r.disallow) ? r.disallow : [],
					})),
				);
			}

			this.crawlDelay.set(data.robotsCrawlDelay != null ? String(data.robotsCrawlDelay) : '');

			this.additionalSitemaps.set(
				Array.isArray(data.robotsAdditionalSitemaps) ? data.robotsAdditionalSitemaps : [],
			);
		} catch {
			this.error.set('Failed to load robots settings');
		} finally {
			this.loading.set(false);
		}
	}
}
