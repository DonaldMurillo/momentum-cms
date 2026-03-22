import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, type Params, type Data } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { LivePreviewService } from '@momentumcms/admin/live-preview';
import { ArticleDetailComponent } from '../pages/article-detail.component';

/**
 * Live preview wrapper for Articles.
 *
 * Renders the ACTUAL ArticleDetailComponent with a mock ActivatedRoute that feeds
 * LivePreviewService data as if it came from the route resolver.
 */
@Component({
	selector: 'app-article-preview',
	imports: [ArticleDetailComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block min-h-full' },
	providers: [
		{
			provide: ActivatedRoute,
			useFactory: () => {
				const preview = inject(LivePreviewService);

				const params$ = new BehaviorSubject<Params>({});
				const data$ = new BehaviorSubject<Data>({});

				effect(() => {
					const doc = preview.documentData();
					const slug = String(doc['slug'] ?? '');

					params$.next({ slug });
					data$.next({
						articleData: {
							docs: [doc],
							totalDocs: 1,
							page: 1,
							totalPages: 1,
							limit: 1,
							hasNextPage: false,
							hasPrevPage: false,
						},
					});
				});

				return {
					params: params$.asObservable(),
					data: data$.asObservable(),
					snapshot: { data: {}, params: { slug: '' } },
				};
			},
		},
	],
	template: `<app-article-detail />`,
})
export class ArticlePreviewComponent {}
