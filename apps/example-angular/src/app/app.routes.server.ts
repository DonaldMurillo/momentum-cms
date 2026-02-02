import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
	// Landing page can be prerendered
	{
		path: '',
		renderMode: RenderMode.Prerender,
	},
	// Admin routes use server-side rendering
	{
		path: 'admin/**',
		renderMode: RenderMode.Server,
	},
	// Default to server rendering
	{
		path: '**',
		renderMode: RenderMode.Server,
	},
];
