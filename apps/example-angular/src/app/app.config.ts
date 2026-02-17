import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import {
	provideClientHydration,
	withEventReplay,
	withIncrementalHydration,
} from '@angular/platform-browser';
import { crudToastInterceptor, provideMomentumFieldRenderers } from '@momentumcms/admin';

import { providePageBlocks } from '@momentumcms/example-config/pages';

export const appConfig: ApplicationConfig = {
	providers: [
		provideHttpClient(withFetch(), withInterceptors([crudToastInterceptor])),
		provideClientHydration(withEventReplay(), withIncrementalHydration()),
		provideBrowserGlobalErrorListeners(),
		provideRouter(appRoutes, withViewTransitions()),
		provideMomentumFieldRenderers(),
		...providePageBlocks(),
	],
};
