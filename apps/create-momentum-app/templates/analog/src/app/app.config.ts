import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import {
	momentumAdminRoutes,
	crudToastInterceptor,
	provideMomentumFieldRenderers,
} from '@momentumcms/admin';
import { adminConfig } from '../generated/momentum.config';
import { providePostBlocks } from './pages/post-block-providers';

const adminRoutes = momentumAdminRoutes(adminConfig);

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideFileRouter(withExtraRoutes(adminRoutes)),
		provideHttpClient(
			withFetch(),
			withInterceptors([crudToastInterceptor, requestContextInterceptor]),
		),
		provideClientHydration(withEventReplay()),
		provideMomentumFieldRenderers(),
		...providePostBlocks(),
	],
};
