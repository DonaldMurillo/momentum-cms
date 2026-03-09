import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
	// Landing page can be prerendered
	{
		path: '',
		renderMode: RenderMode.Prerender,
	},
	// Admin routes are client-only (no SSR) — behind auth, not indexed by search engines,
	// and contain dynamic widgets (live preview, forms) that cause hydration mismatches
	{
		path: 'admin/**',
		renderMode: RenderMode.Client,
	},
	// The headless styling lab is a demo/test harness with many interactive primitives.
	// Keep it client-rendered so the showcase cannot wedge SSR for the whole app.
	{
		path: 'headless-styling-lab',
		renderMode: RenderMode.Client,
	},
	// Default to server rendering
	{
		path: '**',
		renderMode: RenderMode.Server,
	},
];
