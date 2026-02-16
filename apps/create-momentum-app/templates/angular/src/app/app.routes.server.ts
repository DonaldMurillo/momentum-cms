import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
	// All routes use server-side rendering
	{
		path: '**',
		renderMode: RenderMode.Server,
	},
];
