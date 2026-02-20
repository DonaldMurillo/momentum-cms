import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { injectMomentumAPI, type FindResult } from '@momentumcms/admin';

interface ArticleDetail {
	id: string;
	title: string;
	content: string;
	categoryName: string | null;
	coverImageUrl: string | null;
}

@Component({
	selector: 'app-article-detail',
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 md:py-12',
	},
	template: `
		<a
			routerLink="/articles"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
			data-testid="article-back-link"
		>
			&larr; Back to Articles
		</a>

		@if (loading()) {
			<p class="text-muted-foreground" data-testid="article-loading">Loading article...</p>
		} @else if (error()) {
			<div class="text-center py-12" data-testid="article-error">
				<h1 class="text-2xl font-bold text-foreground mb-2">Article not found</h1>
				<p class="text-muted-foreground">The article you are looking for does not exist.</p>
			</div>
		} @else if (article(); as art) {
			<article data-testid="article-detail">
				@if (art.categoryName) {
					<span
						class="inline-block px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-4"
						data-testid="article-detail-category"
					>
						{{ art.categoryName }}
					</span>
				}

				<h1
					class="text-3xl md:text-4xl font-bold text-foreground mb-6"
					data-testid="article-detail-title"
				>
					{{ art.title }}
				</h1>

				@if (art.coverImageUrl) {
					<img
						[src]="art.coverImageUrl"
						[alt]="art.title"
						class="w-full rounded-lg mb-8 object-cover max-h-96"
						data-testid="article-detail-cover"
					/>
				}

				@if (contentHtml()) {
					<div
						class="text-foreground leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-4 [&_p]:text-muted-foreground [&_strong]:text-foreground [&_em]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline"
						[innerHTML]="contentHtml()"
						data-testid="article-detail-content"
					></div>
				}
			</article>
		}
	`,
})
export class ArticleDetailComponent {
	private readonly route = inject(ActivatedRoute);
	private readonly api = injectMomentumAPI();
	private readonly titleService = inject(Title);
	private readonly metaService = inject(Meta);

	readonly article = signal<ArticleDetail | null>(null);
	readonly loading = signal(true);
	readonly error = signal(false);

	readonly contentHtml = computed((): string => this.article()?.content ?? '');

	/**
	 * Resolved article data from the route resolver (SSR-safe).
	 * When a resolver is configured, the router awaits it before rendering,
	 * so data is available on first render — critical for SSR preview in the admin iframe.
	 */
	private readonly resolvedArticle = toSignal(
		this.route.data.pipe(
			map((data): Record<string, unknown> | null => {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- route resolver returns FindResult
				const result = data['articleData'] as FindResult<Record<string, unknown>> | undefined;
				if (!result || !result.docs[0]) return null;
				return result.docs[0];
			}),
		),
	);

	constructor() {
		const resolvedDoc = this.resolvedArticle();

		if (resolvedDoc) {
			// Resolver provided data — use it directly (SSR path)
			void this.populateFromDoc(resolvedDoc);
		} else {
			// No resolver data — fetch client-side (fallback for routes without resolver)
			const slug: unknown = this.route.snapshot.params['slug'];
			if (typeof slug === 'string') {
				void this.loadArticle(slug);
			} else {
				this.loading.set(false);
				this.error.set(true);
			}
		}
	}

	/**
	 * Populate article from a resolved document (either from resolver or API).
	 */
	private async populateFromDoc(doc: Record<string, unknown>): Promise<void> {
		try {
			let categoryName: string | null = null;
			const catId = doc['category'];
			if (catId && typeof catId === 'string') {
				const catDoc = await this.api
					.collection<Record<string, unknown>>('categories')
					.findById(catId);
				if (catDoc) {
					categoryName = String(catDoc['name'] ?? '');
				}
			}

			let coverImageUrl: string | null = null;
			const coverImage = doc['coverImage'];
			if (coverImage && typeof coverImage === 'string') {
				coverImageUrl = `/api/media/${coverImage}/file`;
			}

			const title = String(doc['title'] ?? '');
			const rawContent = String(doc['content'] ?? '');
			const description = rawContent
				.replace(/<[^>]*>/g, '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 160);

			this.article.set({
				id: String(doc['id'] ?? ''),
				title,
				content: rawContent,
				categoryName,
				coverImageUrl,
			});

			this.titleService.setTitle(`${title} | Momentum CMS`);
			this.metaService.updateTag({ name: 'description', content: description });
			this.metaService.updateTag({ property: 'og:title', content: title });
			this.metaService.updateTag({ property: 'og:description', content: description });
			this.metaService.updateTag({ property: 'og:type', content: 'article' });
		} catch {
			this.error.set(true);
		} finally {
			this.loading.set(false);
		}
	}

	private async loadArticle(slug: string): Promise<void> {
		try {
			const result = await this.api
				.collection<Record<string, unknown>>('articles')
				.find({ where: { slug: { equals: slug } }, limit: 1 });

			const doc = result.docs[0];
			if (!doc) {
				this.error.set(true);
				this.loading.set(false);
				return;
			}

			await this.populateFromDoc(doc);
		} catch {
			this.error.set(true);
			this.loading.set(false);
		}
	}
}
