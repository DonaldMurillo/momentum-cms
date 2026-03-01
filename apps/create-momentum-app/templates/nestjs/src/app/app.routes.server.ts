import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
	// Admin routes render client-side — guards need to run without SSR hydration conflict
	{ path: 'admin/**', renderMode: RenderMode.Client },
	// All other routes use server-side rendering
	{ path: '**', renderMode: RenderMode.Server },
];
