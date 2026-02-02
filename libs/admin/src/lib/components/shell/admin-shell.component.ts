import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import type { MomentumAdminBranding } from '../../routes/momentum-admin-routes';
import { getCollectionsFromRouteData, getBrandingFromRouteData } from '../../utils/route-data';

/**
 * Admin Shell Component
 *
 * The main layout component for the admin UI.
 * Provides navigation sidebar and content area.
 */
@Component({
	selector: 'mcms-admin-shell',
	standalone: true,
	imports: [RouterOutlet, RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="mcms-admin-shell">
			<!-- Sidebar -->
			<aside class="mcms-sidebar">
				<div class="mcms-sidebar-header">
					@if (branding()?.logo) {
						<img [src]="branding()!.logo" alt="Logo" class="mcms-logo" />
					}
					<h1 class="mcms-site-title">{{ branding()?.title || 'Momentum CMS' }}</h1>
				</div>

				<nav class="mcms-nav">
					<a routerLink="" class="mcms-nav-item mcms-nav-dashboard"> Dashboard </a>

					<div class="mcms-nav-section">
						<h2 class="mcms-nav-section-title">Collections</h2>
						@for (collection of collections(); track collection.slug) {
							<a [routerLink]="['collections', collection.slug]" class="mcms-nav-item">
								{{ collection.labels?.plural || collection.slug }}
							</a>
						}
					</div>
				</nav>
			</aside>

			<!-- Main Content -->
			<main class="mcms-main">
				@defer (hydrate on immediate) {
					<router-outlet></router-outlet>
				}
			</main>
		</div>
	`,
	styles: [
		`
			.mcms-admin-shell {
				display: flex;
				min-height: 100vh;
				background-color: #f3f4f6;
			}

			.mcms-sidebar {
				width: 256px;
				background-color: #1f2937;
				color: white;
				display: flex;
				flex-direction: column;
			}

			.mcms-sidebar-header {
				padding: 1.5rem;
				border-bottom: 1px solid #374151;
			}

			.mcms-logo {
				height: 2rem;
				margin-bottom: 0.5rem;
			}

			.mcms-site-title {
				font-size: 1.25rem;
				font-weight: 600;
				margin: 0;
			}

			.mcms-nav {
				flex: 1;
				padding: 1rem;
			}

			.mcms-nav-item {
				display: block;
				padding: 0.75rem 1rem;
				color: #d1d5db;
				text-decoration: none;
				border-radius: 0.375rem;
				transition: background-color 0.15s;
			}

			.mcms-nav-item:hover {
				background-color: #374151;
				color: white;
			}

			.mcms-nav-dashboard {
				margin-bottom: 1rem;
			}

			.mcms-nav-section {
				margin-top: 1rem;
			}

			.mcms-nav-section-title {
				font-size: 0.75rem;
				font-weight: 600;
				color: #9ca3af;
				text-transform: uppercase;
				padding: 0.5rem 1rem;
				margin: 0;
			}

			.mcms-main {
				flex: 1;
				padding: 2rem;
			}
		`,
	],
})
export class AdminShellComponent {
	private readonly route = inject(ActivatedRoute);

	readonly collections = computed((): CollectionConfig[] => {
		return getCollectionsFromRouteData(this.route.snapshot.data);
	});

	readonly branding = computed((): MomentumAdminBranding | undefined => {
		return getBrandingFromRouteData(this.route.snapshot.data);
	});
}
