import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import { momentumAdminRoutes, crudToastInterceptor } from '@momentum-cms/admin';
import { BASE_AUTH_COLLECTIONS } from '@momentum-cms/auth';
import { Posts } from '../collections/posts';

const adminRoutes = momentumAdminRoutes({
	basePath: '/admin',
	collections: [Posts, ...BASE_AUTH_COLLECTIONS],
	branding: {
		title: 'Momentum CMS',
	},
});

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideFileRouter(withExtraRoutes(adminRoutes)),
		provideHttpClient(
			withFetch(),
			withInterceptors([crudToastInterceptor, requestContextInterceptor]),
		),
		provideClientHydration(withEventReplay()),
	],
};
