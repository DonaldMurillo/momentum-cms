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
	createdAt: string;
}

@Component({
	selector: 'app-article-detail',
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block mx-auto max-w-5xl px-4 md:px-8 py-12 md:py-20',
	},
	template: `
		<a
			routerLink="/articles"
			class="inline-flex items-baseline gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-10 transition-colors"
			data-testid="article-back-link"
		>
			<span aria-hidden="true">←</span>
			Back to Articles
		</a>

		@if (loading()) {
			<p
				class="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
				data-testid="article-loading"
			>
				Loading
			</p>
		} @else if (error()) {
			<div class="border-y border-border py-12 text-center" data-testid="article-error">
				<h1 class="text-2xl font-semibold -tracking-[0.018em] text-foreground mb-2">
					Article not found
				</h1>
				<p class="text-sm text-muted-foreground">The article you are looking for does not exist.</p>
			</div>
		} @else if (article(); as art) {
			<article data-testid="article-detail">
				<!-- Editorial header — eyebrow with category + date, then large display title.
				     Constrained to a reading column so the title doesn't sprawl. -->
				<header class="max-w-3xl mb-10">
					<div class="flex items-baseline gap-3 mb-4 flex-wrap">
						@if (art.categoryName) {
							<span
								class="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
								data-testid="article-detail-category"
							>
								{{ art.categoryName }}
							</span>
						}
						@if (art.createdAt) {
							<span
								class="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 font-mono tabular-nums"
							>
								{{ formatDate(art.createdAt) }}
							</span>
						}
					</div>
					<h1
						class="text-4xl md:text-5xl font-semibold -tracking-[0.025em] leading-[1.1] text-foreground"
						data-testid="article-detail-title"
					>
						{{ art.title }}
					</h1>
				</header>

				@if (art.coverImageUrl) {
					<img
						[src]="art.coverImageUrl"
						[alt]="art.title"
						class="w-full mb-12 object-cover max-h-[28rem] border border-border"
						data-testid="article-detail-cover"
					/>
				}

				@if (contentHtml()) {
					<div
						class="max-w-[68ch] text-base md:text-lg text-foreground/85 leading-[1.75] [&_h2]:text-2xl [&_h2]:md:text-3xl [&_h2]:font-semibold [&_h2]:-tracking-[0.018em] [&_h2]:text-foreground [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:-tracking-[0.012em] [&_h3]:text-foreground [&_h3]:mt-10 [&_h3]:mb-3 [&_p]:mb-5 [&_strong]:text-foreground [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5 [&_li]:mb-1.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/30 hover:[&_a]:decoration-primary"
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

	/** Render an ISO timestamp as a compact "MMM DD" / "MMM DD ’YY" mono date. */
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
				createdAt: String(doc['createdAt'] ?? ''),
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
