import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, type Params, type Data } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { LivePreviewService } from '@momentumcms/admin/live-preview';
import { PageComponent } from '../pages/page.component';

/**
 * Live preview wrapper for Pages.
 *
 * Renders the ACTUAL PageComponent with a mock ActivatedRoute that feeds
 * LivePreviewService data as if it came from the route resolver.
 */
@Component({
	selector: 'app-page-preview',
	imports: [PageComponent],
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
						slug,
						pageData: {
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
					snapshot: { data: {}, params: {} },
				};
			},
		},
	],
	template: `<app-page />`,
})
export class PagePreviewComponent {}
