import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import { momentumAdminRoutes } from '@momentum-cms/admin';
import { Posts, Users } from '../collections';
import { MediaCollection } from '@momentum-cms/core';

// Admin routes configuration
const adminRoutes = momentumAdminRoutes({
	basePath: '/admin',
	collections: [Posts, Users, MediaCollection],
	branding: {
		title: 'Momentum CMS',
	},
});

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),

		provideFileRouter(withExtraRoutes(adminRoutes)),
		provideClientHydration(),
		provideHttpClient(withFetch(), withInterceptors([requestContextInterceptor])),
	],
};
