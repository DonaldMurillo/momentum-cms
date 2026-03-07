import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
	crudToastInterceptor,
	provideMomentumFieldRenderers,
	provideAdminComponent,
	provideAdminSlot,
} from '@momentumcms/admin';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [
		provideHttpClient(withFetch(), withInterceptors([crudToastInterceptor])),
		provideClientHydration(withEventReplay()),
		provideBrowserGlobalErrorListeners(),
		provideRouter(appRoutes),
		provideMomentumFieldRenderers(),

		// Provider-level page override: custom dashboard
		provideAdminComponent('dashboard', () =>
			import('./custom-components/custom-dashboard.component').then(
				(m) => m.CustomDashboardComponent,
			),
		),

		// Provider-level slot: shell header banner
		provideAdminSlot('shell:header', () =>
			import('./custom-components/shell-header.component').then((m) => m.ShellHeaderComponent),
		),

		// Provider-level slot: content after dashboard
		provideAdminSlot('dashboard:after', () =>
			import('./custom-components/dashboard-footer.component').then(
				(m) => m.DashboardFooterComponent,
			),
		),

		// Provider-level slot: content after collection list
		provideAdminSlot('collection-list:after', () =>
			import('./custom-components/list-footer.component').then((m) => m.ListFooterComponent),
		),

		// Provider-level slot: nav end widget
		provideAdminSlot('shell:nav-end', () =>
			import('./custom-components/nav-end-widget.component').then((m) => m.NavEndWidgetComponent),
		),

		// Provider-level slot: content after collection edit form
		provideAdminSlot('collection-edit:after', () =>
			import('./custom-components/edit-after-related.component').then(
				(m) => m.EditAfterRelatedComponent,
			),
		),

		// Provider-level slot: content after collection view
		provideAdminSlot('collection-view:after', () =>
			import('./custom-components/view-after-related.component').then(
				(m) => m.ViewAfterRelatedComponent,
			),
		),

		// Provider-level slot: content before collection list (global, all collections)
		provideAdminSlot('collection-list:before', () =>
			import('./custom-components/list-before-filter.component').then(
				(m) => m.ListBeforeFilterComponent,
			),
		),

		// Provider-level slot: content before collection view (global, all collections)
		provideAdminSlot('collection-view:before', () =>
			import('./custom-components/view-before-status.component').then(
				(m) => m.ViewBeforeStatusComponent,
			),
		),

		// Provider-level login slots (must use providers, not config, because
		// the login page renders outside the admin shell)
		provideAdminSlot('login:before', () =>
			import('./custom-components/login-before-banner.component').then(
				(m) => m.LoginBeforeBannerComponent,
			),
		),
		provideAdminSlot('login:after', () =>
			import('./custom-components/login-after-links.component').then(
				(m) => m.LoginAfterLinksComponent,
			),
		),
	],
};
