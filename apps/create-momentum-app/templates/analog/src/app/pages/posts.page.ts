import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { injectMomentumAPI } from '@momentumcms/admin';

interface PostDisplay {
	id: string;
	slug: string;
	title: string;
}

@Component({
	selector: 'app-posts-page',
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12',
	},
	template: `
		<h1 class="text-3xl md:text-4xl font-bold text-foreground mb-2" data-testid="posts-title">
			Posts
		</h1>
		<p class="text-lg text-muted-foreground mb-8">Browse the latest posts.</p>

		<!-- Search -->
		<div class="mb-8">
			<input
				type="text"
				class="w-full md:w-96 px-4 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				placeholder="Search posts..."
				[value]="searchQuery()"
				(input)="onSearchInput($event)"
				data-testid="posts-search"
			/>
		</div>

		<!-- Posts grid -->
		@if (loading()) {
			<p class="text-muted-foreground" data-testid="posts-loading">Loading posts...</p>
		} @else if (error()) {
			<div class="text-center py-12" data-testid="posts-error">
				<p class="text-lg font-semibold text-foreground">Something went wrong</p>
				<p class="text-muted-foreground mt-1">Failed to load posts. Please try again later.</p>
			</div>
		} @else if (filteredPosts().length === 0) {
			<p class="text-muted-foreground" data-testid="posts-empty">No posts found.</p>
		} @else {
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="posts-grid">
				@for (post of filteredPosts(); track post.id) {
					<a
						[routerLink]="['/posts', post.slug]"
						class="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow block"
						data-testid="post-card"
					>
						<div class="p-6">
							<h2 class="text-lg font-semibold text-card-foreground mb-2" data-testid="post-title">
								{{ post.title }}
							</h2>
						</div>
					</a>
				}
			</div>
		}
	`,
})
export default class PostsPageComponent {
	private readonly api = injectMomentumAPI();
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly posts = signal<PostDisplay[]>([]);
	readonly loading = signal(true);
	readonly error = signal(false);
	readonly searchQuery = signal('');

	private readonly titleService = inject(Title);
	private readonly metaService = inject(Meta);

	readonly filteredPosts = computed((): PostDisplay[] => {
		const query = this.searchQuery().toLowerCase();
		if (!query) return this.posts();
		return this.posts().filter((p) => p.title.toLowerCase().includes(query));
	});

	constructor() {
		const params = this.route.snapshot.queryParams;
		const initialSearch = params['search'];
		if (typeof initialSearch === 'string' && initialSearch) {
			this.searchQuery.set(initialSearch);
		}
		this.titleService.setTitle('Posts | Momentum CMS');
		this.metaService.updateTag({
			name: 'description',
			content: 'Browse the latest posts from Momentum CMS.',
		});
		void this.loadPosts();
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

	private async loadPosts(): Promise<void> {
		try {
			const result = await this.api
				.collection<Record<string, unknown>>('posts')
				.find({ limit: 100, sort: '-createdAt' });

			this.posts.set(
				result.docs.map((doc) => ({
					id: String(doc['id'] ?? ''),
					slug: String(doc['slug'] ?? ''),
					title: String(doc['title'] ?? ''),
				})),
			);
		} catch {
			this.error.set(true);
		} finally {
			this.loading.set(false);
		}
	}
}
