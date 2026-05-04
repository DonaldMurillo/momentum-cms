import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { injectMomentumAPI } from '@momentumcms/admin';

interface ArticleDisplay {
	id: string;
	slug: string;
	title: string;
	excerpt: string;
	createdAt: string;
	categoryId: string | null;
	categoryName: string | null;
}

interface CategoryDisplay {
	id: string;
	name: string;
	slug: string;
}

@Component({
	selector: 'app-articles-page',
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block mx-auto max-w-5xl px-4 md:px-8 py-12 md:py-20',
	},
	template: `
		<header class="flex flex-col gap-2 mb-10">
			<span
				class="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
			>
				Writing
			</span>
			<h1
				class="text-3xl md:text-4xl font-semibold -tracking-[0.02em] text-foreground"
				data-testid="articles-title"
			>
				Articles
			</h1>
			<p class="text-base text-muted-foreground max-w-[60ch]">
				Latest writing from our team. Filter by topic or search by title.
			</p>
		</header>

		<!-- Search + filter on one row -->
		<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
			<input
				type="text"
				class="w-full md:max-w-xs h-9 rounded-[var(--mcms-radius)] border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
				placeholder="Search articles…"
				[value]="searchQuery()"
				(input)="onSearchInput($event)"
				data-testid="articles-search"
			/>
		</div>

		<!-- Category filter — small editorial chip rail. -->
		<div class="flex flex-wrap gap-1 mb-10" data-testid="articles-categories">
			<button
				(click)="onCategorySelect(null)"
				class="rounded-sm px-2.5 py-1 text-xs font-medium transition-colors"
				[class]="
					selectedCategory() === null
						? 'bg-foreground text-background'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'
				"
				data-testid="category-all"
			>
				All
			</button>
			@for (cat of categories(); track cat.id) {
				<button
					(click)="onCategorySelect(cat.id)"
					class="rounded-sm px-2.5 py-1 text-xs font-medium transition-colors"
					[class]="
						selectedCategory() === cat.id
							? 'bg-foreground text-background'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'
					"
					[attr.data-testid]="'category-' + cat.slug"
				>
					{{ cat.name }}
				</button>
			}
		</div>

		<!-- Articles list — editorial hairline-divided rows, not a card grid. -->
		@if (loading()) {
			<p class="text-sm text-muted-foreground" data-testid="articles-loading">Loading…</p>
		} @else if (error()) {
			<div class="border-y border-border py-12 text-center" data-testid="articles-error">
				<p class="text-base font-semibold text-foreground">Something went wrong</p>
				<p class="text-sm text-muted-foreground mt-1">
					Failed to load articles. Please try again later.
				</p>
			</div>
		} @else if (filteredArticles().length === 0) {
			<div class="border-y border-border py-12 text-center" data-testid="articles-empty">
				<p class="text-sm text-muted-foreground">No articles match your filters.</p>
			</div>
		} @else {
			<ul class="border-t border-border" data-testid="articles-grid">
				@for (article of filteredArticles(); track article.id) {
					<li class="border-b border-border">
						<a
							[routerLink]="['/articles', article.slug]"
							class="group grid grid-cols-1 md:grid-cols-[8rem_minmax(0,1fr)_8rem] items-baseline gap-x-8 gap-y-2 py-6 hover:bg-muted/30 -mx-3 px-3 transition-colors"
							data-testid="article-card"
						>
							<span
								class="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 font-mono tabular-nums"
							>
								{{ formatDate(article.createdAt) }}
							</span>
							<div class="min-w-0">
								<h2
									class="text-lg md:text-xl font-semibold -tracking-[0.012em] text-foreground group-hover:text-primary transition-colors"
									data-testid="article-title"
								>
									{{ article.title }}
								</h2>
								@if (article.excerpt) {
									<p class="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-[60ch]">
										{{ article.excerpt }}
									</p>
								}
							</div>
							@if (article.categoryName) {
								<span
									class="text-xs text-muted-foreground md:text-right"
									data-testid="article-category"
								>
									{{ article.categoryName }}
								</span>
							}
						</a>
					</li>
				}
			</ul>
		}
	`,
})
export class ArticlesPageComponent {
	private readonly api = injectMomentumAPI();
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly articles = signal<ArticleDisplay[]>([]);
	readonly categories = signal<CategoryDisplay[]>([]);
	readonly loading = signal(true);
	readonly error = signal(false);
	readonly searchQuery = signal('');
	readonly selectedCategory = signal<string | null>(null);

	private readonly titleService = inject(Title);
	private readonly metaService = inject(Meta);
	private pendingCategoryId: string | null = null;

	readonly filteredArticles = computed((): ArticleDisplay[] => {
		let result = this.articles();
		const query = this.searchQuery().toLowerCase();
		if (query) {
			result = result.filter((a) => a.title.toLowerCase().includes(query));
		}
		const catId = this.selectedCategory();
		if (catId) {
			result = result.filter((a) => a.categoryId === catId);
		}
		return result;
	});

	constructor() {
		const params = this.route.snapshot.queryParams;
		const initialSearch = params['search'];
		if (typeof initialSearch === 'string' && initialSearch) {
			this.searchQuery.set(initialSearch);
		}
		const initialCategory = params['category'];
		if (typeof initialCategory === 'string' && initialCategory) {
			this.pendingCategoryId = initialCategory;
		}
		this.titleService.setTitle('Articles | Momentum CMS');
		this.metaService.updateTag({
			name: 'description',
			content: 'Browse the latest articles from Momentum CMS.',
		});
		void this.loadData();
	}

	onSearchInput(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLInputElement) {
			this.searchQuery.set(target.value);
			void this.router.navigate([], {
				queryParams: { search: target.value || null },
				queryParamsHandling: 'merge',
				replaceUrl: true,
			});
		}
	}

	/** Render an ISO timestamp as a compact "MMM DD" / "MMM DD YY" mono date. */
	formatDate(value: string): string {
		if (!value) return '';
		const d = new Date(value);
		if (isNaN(d.getTime())) return '';
		const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
		const day = String(d.getDate()).padStart(2, '0');
		const currentYear = new Date().getFullYear();
		const yearSuffix =
			d.getFullYear() === currentYear ? '' : ` ’${String(d.getFullYear()).slice(-2)}`;
		return `${month} ${day}${yearSuffix}`;
	}

	onCategorySelect(categoryId: string | null): void {
		this.selectedCategory.set(categoryId);
		void this.router.navigate([], {
			queryParams: { category: categoryId },
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});
	}

	private async loadData(): Promise<void> {
		try {
			const [catResult, artResult] = await Promise.all([
				this.api.collection<Record<string, unknown>>('categories').find({ limit: 100 }),
				this.api.collection<Record<string, unknown>>('articles').find({
					where: { _status: { equals: 'published' } },
					limit: 100,
					sort: '-createdAt',
				}),
			]);

			const categoryMap = new Map<string, CategoryDisplay>();
			const cats: CategoryDisplay[] = catResult.docs.map((doc) => {
				const cat: CategoryDisplay = {
					id: String(doc['id'] ?? ''),
					name: String(doc['name'] ?? ''),
					slug: String(doc['slug'] ?? ''),
				};
				categoryMap.set(cat.id, cat);
				return cat;
			});

			// Apply pending category from URL params if valid (use full map, not the
			// usage-filtered list — a deep-link to a category with no articles should
			// still work, even if the chip isn't in the filter rail).
			if (this.pendingCategoryId && categoryMap.has(this.pendingCategoryId)) {
				this.selectedCategory.set(this.pendingCategoryId);
			}
			this.pendingCategoryId = null;

			const arts: ArticleDisplay[] = artResult.docs.map((doc) => {
				const catId = doc['category'] ? String(doc['category']) : null;
				const rawContent = String(doc['content'] ?? '');
				// Strip HTML tags + collapse whitespace to a one-line excerpt.
				const excerpt = rawContent
					.replace(/<[^>]+>/g, ' ')
					.replace(/\s+/g, ' ')
					.trim()
					.slice(0, 160);
				return {
					id: String(doc['id'] ?? ''),
					slug: String(doc['slug'] ?? ''),
					title: String(doc['title'] ?? ''),
					excerpt,
					createdAt: String(doc['createdAt'] ?? ''),
					categoryId: catId,
					categoryName: catId ? (categoryMap.get(catId)?.name ?? null) : null,
				};
			});
			this.articles.set(arts);

			// Show only categories that have at least one published article. Without
			// this, seed/test data can spill 70+ unused "boundary-N" categories into
			// the filter rail. Sorted by usage, so the most-used categories surface first.
			const usage = new Map<string, number>();
			for (const a of arts) {
				if (a.categoryId) usage.set(a.categoryId, (usage.get(a.categoryId) ?? 0) + 1);
			}
			const usedCats = cats
				.filter((c) => (usage.get(c.id) ?? 0) > 0)
				.sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
			this.categories.set(usedCats);
		} catch {
			this.error.set(true);
		} finally {
			this.loading.set(false);
		}
	}
}
