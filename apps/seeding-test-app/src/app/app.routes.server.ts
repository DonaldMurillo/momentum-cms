import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
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
