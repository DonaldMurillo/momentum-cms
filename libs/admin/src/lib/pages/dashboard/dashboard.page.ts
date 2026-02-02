import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import type { CollectionConfig } from '@momentum-cms/core';
import { getCollectionsFromRouteData } from '../../utils/route-data';

/**
 * Dashboard Page Component
 *
 * The main dashboard showing an overview of all collections.
 */
@Component({
	selector: 'mcms-dashboard',
	standalone: true,
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="mcms-dashboard">
			<header class="mcms-page-header">
				<h1>Dashboard</h1>
				<p class="mcms-subtitle">Welcome to Momentum CMS</p>
			</header>

			<div class="mcms-collections-grid">
				@for (collection of collections(); track collection.slug) {
					<a [routerLink]="['collections', collection.slug]" class="mcms-collection-card">
						<h2 class="mcms-collection-title">
							{{ collection.labels?.plural || collection.slug }}
						</h2>
						<p class="mcms-collection-slug">{{ collection.slug }}</p>
						<div class="mcms-collection-meta">
							<span>{{ collection.fields.length }} fields</span>
						</div>
					</a>
				} @empty {
					<div class="mcms-empty-state">
						<p>No collections configured.</p>
						<p class="mcms-hint">Add collections to your configuration to get started.</p>
					</div>
				}
			</div>
		</div>
	`,
	styles: [
		`
			.mcms-dashboard {
				max-width: 1200px;
			}

			.mcms-page-header {
				margin-bottom: 2rem;
			}

			.mcms-page-header h1 {
				font-size: 2rem;
				font-weight: 700;
				color: #111827;
				margin: 0;
			}

			.mcms-subtitle {
				color: #6b7280;
				margin: 0.5rem 0 0 0;
			}

			.mcms-collections-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
				gap: 1.5rem;
			}

			.mcms-collection-card {
				background: white;
				border-radius: 0.5rem;
				padding: 1.5rem;
				text-decoration: none;
				color: inherit;
				border: 1px solid #e5e7eb;
				transition:
					box-shadow 0.15s,
					border-color 0.15s;
			}

			.mcms-collection-card:hover {
				border-color: #3b82f6;
				box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
			}

			.mcms-collection-title {
				font-size: 1.25rem;
				font-weight: 600;
				color: #111827;
				margin: 0 0 0.25rem 0;
			}

			.mcms-collection-slug {
				color: #6b7280;
				font-size: 0.875rem;
				margin: 0 0 1rem 0;
				font-family: monospace;
			}

			.mcms-collection-meta {
				font-size: 0.875rem;
				color: #9ca3af;
			}

			.mcms-empty-state {
				grid-column: 1 / -1;
				text-align: center;
				padding: 3rem;
				background: white;
				border-radius: 0.5rem;
				border: 1px dashed #d1d5db;
			}

			.mcms-hint {
				color: #9ca3af;
				font-size: 0.875rem;
			}
		`,
	],
})
export class DashboardPage {
	private readonly route = inject(ActivatedRoute);

	readonly collections = computed((): CollectionConfig[] => {
		return getCollectionsFromRouteData(this.route.parent?.snapshot.data);
	});
}
