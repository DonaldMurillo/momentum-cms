import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'mcms-headless-styling-lab-teaser-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="mx-auto flex min-h-[60vh] max-w-4xl flex-col justify-center gap-6 px-6 py-16">
			<div class="space-y-3">
				<p class="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
					Headless Styling Lab
				</p>
				<h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
					Theme editor demo entry point
				</h1>
				<p class="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
					The full primitive stress harness lives in the Angular example app. This shared entry page
					keeps the public demo route available in the Analog and NestJS examples so the theme
					editor flow has a stable hand-off instead of face-planting into a 404.
				</p>
			</div>

			<div class="flex flex-wrap gap-3">
				<a
					href="/theme-editor"
					data-testid="lab-theme-editor-link"
					class="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
				>
					Open Theme Editor
				</a>
				<a
					href="/showcase"
					class="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
				>
					Back to Showcase
				</a>
			</div>
		</section>
	`,
})
export class HeadlessStylingLabTeaserPage {}
