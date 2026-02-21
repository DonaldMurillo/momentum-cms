import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { injectMomentumAPI, type FindResult } from '@momentumcms/admin';
import { BlockRendererComponent } from '@momentumcms/ui';
import type { RouteMeta } from '@analogjs/router';
import { postDetailResolver } from '../post-detail.resolver';

export const routeMeta: RouteMeta = {
	resolve: { postData: postDetailResolver },
};

interface PostDetail {
	id: string;
	title: string;
	blocks: Array<Record<string, unknown>>;
}

@Component({
	selector: 'app-post-detail',
	imports: [RouterLink, BlockRendererComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 md:py-12',
	},
	template: `
		<a
			routerLink="/posts"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
			data-testid="post-back-link"
		>
			&larr; Back to Posts
		</a>

		@if (loading()) {
			<p class="text-muted-foreground" data-testid="post-loading">Loading post...</p>
		} @else if (error()) {
			<div class="text-center py-12" data-testid="post-error">
				<h1 class="text-2xl font-bold text-foreground mb-2">Post not found</h1>
				<p class="text-muted-foreground">The post you are looking for does not exist.</p>
			</div>
		} @else if (post(); as p) {
			<article data-testid="post-detail">
				<h1
					class="text-3xl md:text-4xl font-bold text-foreground mb-6"
					data-testid="post-detail-title"
				>
					{{ p.title }}
				</h1>

				<div data-testid="post-blocks">
					<mcms-block-renderer [blocks]="p.blocks" />
				</div>
			</article>
		}
	`,
})
export default class PostDetailComponent {
	private readonly route = inject(ActivatedRoute);
	private readonly api = injectMomentumAPI();
	private readonly titleService = inject(Title);
	private readonly metaService = inject(Meta);

	readonly post = signal<PostDetail | null>(null);
	readonly loading = signal(true);
	readonly error = signal(false);

	readonly blocks = computed((): Array<Record<string, unknown>> => this.post()?.blocks ?? []);

	/**
	 * Resolved post data from the route resolver (SSR-safe).
	 */
	private readonly resolvedPost = toSignal(
		this.route.data.pipe(
			map((data): Record<string, unknown> | null => {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- route resolver returns FindResult
				const result = data['postData'] as FindResult<Record<string, unknown>> | undefined;
				if (!result || !result.docs[0]) return null;
				return result.docs[0];
			}),
		),
	);

	constructor() {
		const resolvedDoc = this.resolvedPost();

		if (resolvedDoc) {
			this.populateFromDoc(resolvedDoc);
		} else {
			const slug: unknown = this.route.snapshot.params['slug'];
			if (typeof slug === 'string') {
				void this.loadPost(slug);
			} else {
				this.loading.set(false);
				this.error.set(true);
			}
		}
	}

	private populateFromDoc(doc: Record<string, unknown>): void {
		const title = String(doc['title'] ?? '');
		const rawBlocks = doc['pageContent'];
		const blockList = Array.isArray(rawBlocks)
			? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- blocks from API are Record arrays
				(rawBlocks as Array<Record<string, unknown>>)
			: [];

		this.post.set({
			id: String(doc['id'] ?? ''),
			title,
			blocks: blockList,
		});

		this.titleService.setTitle(`${title} | Momentum CMS`);
		this.metaService.updateTag({
			name: 'description',
			content: `Read "${title}" on Momentum CMS.`,
		});
		this.metaService.updateTag({ property: 'og:title', content: title });
		this.metaService.updateTag({ property: 'og:type', content: 'article' });
		this.loading.set(false);
	}

	private async loadPost(slug: string): Promise<void> {
		try {
			const result = await this.api
				.collection<Record<string, unknown>>('posts')
				.find({ where: { slug: { equals: slug } }, limit: 1 });

			const doc = result.docs[0];
			if (!doc) {
				this.error.set(true);
				this.loading.set(false);
				return;
			}

			this.populateFromDoc(doc);
		} catch {
			this.error.set(true);
			this.loading.set(false);
		}
	}
}
