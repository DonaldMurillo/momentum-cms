import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { injectMomentumAPI } from '@momentumcms/admin';

interface ArticleDisplay {
	id: string;
	title: string;
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
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
	},
	template: `
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
			<h1 class="text-3xl md:text-4xl font-bold text-foreground mb-2" data-testid="articles-title">
				Articles
			</h1>
			<p class="text-lg text-muted-foreground mb-8">Latest articles from our CMS.</p>

			<!-- Search -->
			<div class="mb-6">
				<input
					type="text"
					class="w-full md:w-96 px-4 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="Search articles..."
					[value]="searchQuery()"
					(input)="onSearchInput($event)"
					data-testid="articles-search"
				/>
			</div>

			<!-- Category filter -->
			<div class="flex flex-wrap gap-2 mb-8" data-testid="articles-categories">
				<button
					(click)="selectedCategory.set(null)"
					class="px-3 py-1 rounded-full text-sm font-medium transition-colors"
					[class]="
						selectedCategory() === null
							? 'bg-primary text-primary-foreground'
							: 'bg-secondary text-secondary-foreground hover:bg-accent'
					"
					data-testid="category-all"
				>
					All
				</button>
				@for (cat of categories(); track cat.id) {
					<button
						(click)="selectedCategory.set(cat.id)"
						class="px-3 py-1 rounded-full text-sm font-medium transition-colors"
						[class]="
							selectedCategory() === cat.id
								? 'bg-primary text-primary-foreground'
								: 'bg-secondary text-secondary-foreground hover:bg-accent'
						"
						[attr.data-testid]="'category-' + cat.slug"
					>
						{{ cat.name }}
					</button>
				}
			</div>

			<!-- Articles grid -->
			@if (loading()) {
				<p class="text-muted-foreground" data-testid="articles-loading">Loading articles...</p>
			} @else if (filteredArticles().length === 0) {
				<p class="text-muted-foreground" data-testid="articles-empty">No articles found.</p>
			} @else {
				<div
					class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
					data-testid="articles-grid"
				>
					@for (article of filteredArticles(); track article.id) {
						<article
							class="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
							data-testid="article-card"
						>
							<div class="p-6">
								<h2
									class="text-lg font-semibold text-card-foreground mb-2"
									data-testid="article-title"
								>
									{{ article.title }}
								</h2>
								@if (article.categoryName) {
									<span
										class="inline-block px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
										data-testid="article-category"
									>
										{{ article.categoryName }}
									</span>
								}
							</div>
						</article>
					}
				</div>
			}
		</div>
	`,
})
export class ArticlesPageComponent {
	private readonly api = injectMomentumAPI();

	readonly articles = signal<ArticleDisplay[]>([]);
	readonly categories = signal<CategoryDisplay[]>([]);
	readonly loading = signal(true);
	readonly searchQuery = signal('');
	readonly selectedCategory = signal<string | null>(null);

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
		void this.loadData();
	}

	onSearchInput(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLInputElement) {
			this.searchQuery.set(target.value);
		}
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
			this.categories.set(cats);

			const arts: ArticleDisplay[] = artResult.docs.map((doc) => {
				const catId = doc['category'] ? String(doc['category']) : null;
				return {
					id: String(doc['id'] ?? ''),
					title: String(doc['title'] ?? ''),
					categoryId: catId,
					categoryName: catId ? (categoryMap.get(catId)?.name ?? null) : null,
				};
			});
			this.articles.set(arts);
		} finally {
			this.loading.set(false);
		}
	}
}
