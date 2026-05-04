import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { CollectionConfig, GlobalConfig } from '@momentumcms/core';
import { AdminSlotOutlet } from '../../components/admin-slot-outlet/admin-slot-outlet.component';
import {
	Sidebar,
	SidebarNav,
	SidebarNavItem,
	SidebarSection,
	Avatar,
	AvatarFallback,
	DropdownMenu,
	DropdownMenuItem,
	DropdownSeparator,
	DropdownLabel,
	DropdownTrigger,
} from '@momentumcms/ui';
import { NgIcon } from '@ng-icons/core';
import type { AdminBranding, AdminUser } from '../widget.types';
import { humanizeFieldName } from '@momentumcms/core';
import { McmsThemeService } from '../../ui/theme/theme.service';
import type { AdminPluginRoute } from '../../routes/momentum-admin-routes';
import { groupCollections } from '../../utils/group-collections';

interface GlobalGroup {
	name: string;
	globals: GlobalConfig[];
}

interface PluginRouteGroup {
	name: string;
	routes: AdminPluginRoute[];
}

/**
 * Admin Sidebar Widget
 *
 * CMS-specific sidebar with collection navigation and user section.
 * Composes UI library Sidebar components with Momentum CMS logic.
 *
 * Features:
 * - Collection grouping via admin.group field
 * - Plugin-registered route sections
 *
 * @example
 * ```html
 * <mcms-admin-sidebar
 *   [branding]="{ title: 'My CMS', logo: '/logo.svg' }"
 *   [collections]="collections"
 *   [pluginRoutes]="pluginRoutes"
 *   [user]="currentUser"
 *   basePath="/admin"
 *   (signOut)="onSignOut()"
 * />
 * ```
 */
@Component({
	selector: 'mcms-admin-sidebar',
	imports: [
		Sidebar,
		SidebarNav,
		SidebarNavItem,
		SidebarSection,
		Avatar,
		AvatarFallback,
		DropdownMenu,
		DropdownMenuItem,
		DropdownSeparator,
		DropdownLabel,
		DropdownTrigger,
		NgIcon,
		AdminSlotOutlet,
	],
	// Icons are provided at the admin route level via provideAdminIcons() —
	// no per-component provideIcons() needed. Any heroicons/outline name works.
	host: {
		class: 'shrink-0',
	},
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-sidebar [collapsed]="collapsed()" [width]="width()">
			<!-- Header — typographic wordmark, no brand-color "logo box". Subtle accent
			       comes from a single tracked uppercase eyebrow above the title. -->
			<div mcmsSidebarHeader class="px-2.5">
				<div class="flex items-center gap-2.5">
					@if (branding()?.logo) {
						<img
							[src]="branding()!.logo"
							[alt]="(branding()?.title || 'Momentum CMS') + ' logo'"
							class="h-7 w-7 shrink-0"
						/>
					} @else {
						<!-- Default mark: a single ultramarine glyph, no chrome -->
						<ng-icon name="heroBolt" class="text-primary shrink-0" size="18" aria-hidden="true" />
					}
					<div class="flex flex-col min-w-0 leading-tight">
						@if (eyebrowLabel()) {
							<span class="mcms-eyebrow">{{ eyebrowLabel() }}</span>
						}
						<h1 class="text-base font-semibold -tracking-[0.015em] truncate">
							{{ branding()?.title || 'Momentum' }}
						</h1>
					</div>
				</div>
			</div>

			<!-- Navigation -->
			<div mcmsSidebarContent>
				<mcms-sidebar-nav ariaLabel="Main navigation">
					<!-- Dashboard -->
					<mcms-sidebar-nav-item
						label="Dashboard"
						[href]="basePath()"
						icon="heroSquares2x2"
						[exact]="true"
					/>

					<!-- Media Library (dedicated page, not a collection route) -->
					<mcms-sidebar-nav-item
						label="Media Library"
						[href]="basePath() + '/media'"
						icon="heroPhoto"
					/>

					<mcms-admin-slot slot="shell:nav-start" />

					<!-- Collection Sections (grouped by admin.group) -->
					@for (group of collectionGroups(); track group.id) {
						<mcms-sidebar-section [title]="group.name">
							@for (collection of group.collections; track collection.slug) {
								<mcms-sidebar-nav-item
									[label]="getCollectionLabel(collection)"
									[href]="getCollectionPath(collection)"
									[icon]="getCollectionIcon(collection)"
								/>
							}
						</mcms-sidebar-section>
					}
					@if (collections().length === 0) {
						<mcms-sidebar-section title="Collections">
							<p class="px-3 py-2 text-sm text-sidebar-foreground/70">No collections available</p>
						</mcms-sidebar-section>
					}

					<!-- Global Sections (grouped by admin.group) -->
					@for (group of globalGroups(); track group.name) {
						<mcms-sidebar-section [title]="group.name">
							@for (global of group.globals; track global.slug) {
								<mcms-sidebar-nav-item
									[label]="getGlobalLabel(global)"
									[href]="basePath() + '/globals/' + global.slug"
									[icon]="global.admin?.icon || 'heroCog6Tooth'"
								/>
							}
						</mcms-sidebar-section>
					}

					<!-- Plugin Route Sections -->
					@for (group of pluginRouteGroups(); track group.name) {
						<mcms-sidebar-section [title]="group.name">
							@for (route of group.routes; track route.path) {
								<mcms-sidebar-nav-item
									[label]="route.label"
									[href]="basePath() + '/' + route.path"
									[icon]="route.icon"
									[exact]="true"
								/>
							}
						</mcms-sidebar-section>
					}

					<mcms-admin-slot slot="shell:nav-end" />
				</mcms-sidebar-nav>
			</div>

			<!-- Footer with User Menu -->
			<div mcmsSidebarFooter>
				@if (user(); as u) {
					<button
						class="w-full flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent transition-colors cursor-pointer text-left border-none bg-transparent"
						[mcmsDropdownTrigger]="userMenu"
						dropdownSide="top"
						dropdownAlign="start"
						aria-haspopup="menu"
						[attr.aria-label]="'User menu for ' + u.name"
					>
						<mcms-avatar size="sm" [ariaLabel]="u.name + ' avatar'">
							<mcms-avatar-fallback [delayMs]="0">
								{{ getUserInitials(u.name) }}
							</mcms-avatar-fallback>
						</mcms-avatar>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{{ u.name }}</p>
							<p class="text-xs text-sidebar-foreground/70 truncate">{{ u.email }}</p>
						</div>
						<ng-icon
							name="heroChevronUpDown"
							class="text-muted-foreground"
							size="16"
							aria-hidden="true"
						/>
					</button>

					<ng-template #userMenu>
						<mcms-dropdown-menu class="w-56">
							<mcms-dropdown-label>{{ u.email }}</mcms-dropdown-label>
							<mcms-dropdown-separator />
							<button mcms-dropdown-item value="theme" (selected)="toggleTheme()">
								{{ theme.isDark() ? 'Light mode' : 'Dark mode' }}
							</button>
							<mcms-dropdown-separator />
							<button mcms-dropdown-item value="signout" (selected)="onSignOutClick()">
								Sign out
							</button>
						</mcms-dropdown-menu>
					</ng-template>
				}
			</div>
		</mcms-sidebar>
	`,
})
export class AdminSidebarWidget {
	readonly theme = inject(McmsThemeService);

	/** Branding configuration (logo, title) */
	readonly branding = input<AdminBranding>();

	/** Resolved eyebrow label. Defaults to `'CMS'` only when no custom title is
	 * provided — otherwise white-label deployments would read "CMS / Acme". A
	 * consumer can pass `branding.eyebrow` to opt back in with their own label. */
	readonly eyebrowLabel = computed((): string => {
		const b = this.branding();
		if (b?.eyebrow !== undefined) return b.eyebrow;
		return b?.title ? '' : 'CMS';
	});

	/** Collections to display in navigation */
	readonly collections = input<CollectionConfig[]>([]);

	/** Globals to display in navigation */
	readonly globals = input<GlobalConfig[]>([]);

	/** Plugin-registered admin routes */
	readonly pluginRoutes = input<AdminPluginRoute[]>([]);

	/** Current authenticated user */
	readonly user = input<AdminUser | null>(null);

	/** Base path for admin routes */
	readonly basePath = input('/admin');

	/** Whether the sidebar is collapsed */
	readonly collapsed = input(false);

	/** Sidebar width */
	readonly width = input('16rem');

	/** Emitted when user clicks sign out */
	readonly signOut = output<void>();

	/** Computed collections base path */
	readonly collectionsBasePath = computed(() => `${this.basePath()}/collections`);

	/** Collections grouped by admin.group field */
	readonly collectionGroups = computed(() => groupCollections(this.collections()));

	/** Globals grouped by admin.group field */
	readonly globalGroups = computed((): GlobalGroup[] => {
		const globals = this.globals();
		if (globals.length === 0) return [];

		const DEFAULT_GROUP = 'Globals';
		const groupMap = new Map<string, GlobalConfig[]>();

		for (const g of globals) {
			const name = g.admin?.group ?? DEFAULT_GROUP;
			const list = groupMap.get(name) ?? [];
			list.push(g);
			groupMap.set(name, list);
		}

		const groups: GlobalGroup[] = [];
		for (const [name, globalList] of groupMap) {
			groups.push({ name, globals: globalList });
		}
		return groups;
	});

	/** Plugin routes grouped by group field */
	readonly pluginRouteGroups = computed((): PluginRouteGroup[] => {
		const routes = this.pluginRoutes();
		if (routes.length === 0) return [];

		const DEFAULT_GROUP = 'Plugins';
		const groupMap = new Map<string, AdminPluginRoute[]>();

		for (const r of routes) {
			const name = r.group ?? DEFAULT_GROUP;
			const list = groupMap.get(name) ?? [];
			list.push(r);
			groupMap.set(name, list);
		}

		const groups: PluginRouteGroup[] = [];
		for (const [name, routeList] of groupMap) {
			groups.push({ name, routes: routeList });
		}
		return groups;
	});

	/** Collection icon names by slug.
	 *
	 * Each collection has a distinct heroicon. No two slugs share the same icon —
	 * collisions hurt sidebar scanability. Keep semantically obvious. The full
	 * heroicon outline set (~324 icons) is registered globally via `provideAdminIcons()`,
	 * so any `hero*` name works.
	 */
	private readonly collectionIcons: Record<string, string> = {
		// ── Content ──────────────────────────────────────────────────────────
		posts: 'heroPencilSquare',
		articles: 'heroNewspaper',
		pages: 'heroDocument',
		media: 'heroPhoto',
		categories: 'heroSquares2x2',
		tags: 'heroHashtag',
		'user-notes': 'heroBookOpen',
		'hook-test-items': 'heroBeaker',
		'field-test-items': 'heroBeaker',

		// ── E-commerce / catalog ─────────────────────────────────────────────
		products: 'heroShoppingBag',
		events: 'heroCalendar',

		// ── Forms ────────────────────────────────────────────────────────────
		forms: 'heroClipboardDocumentList',
		'form-submissions': 'heroInboxArrowDown',

		// ── Auth ─────────────────────────────────────────────────────────────
		users: 'heroUsers',
		'auth-user': 'heroUsers',
		'auth-session': 'heroComputerDesktop',
		'auth-account': 'heroIdentification',
		'auth-api-keys': 'heroKey',
		'auth-verification': 'heroShieldCheck',

		// ── Settings / config ────────────────────────────────────────────────
		settings: 'heroCog6Tooth',
		'site-settings': 'heroAdjustmentsHorizontal',

		// ── Routing ──────────────────────────────────────────────────────────
		redirects: 'heroArrowsRightLeft',

		// ── Analytics ────────────────────────────────────────────────────────
		'tracking-rules': 'heroCursorArrowRays',

		// ── Email ────────────────────────────────────────────────────────────
		'email-templates': 'heroEnvelopeOpen',

		// ── System / infra ───────────────────────────────────────────────────
		'queue-jobs': 'heroQueueList',
		'cron-schedules': 'heroClock',
		'otel-snapshots': 'heroChartPie',

		// ── Fallback ─────────────────────────────────────────────────────────
		default: 'heroFolder',
	};

	/**
	 * Get display label for a collection.
	 */
	getCollectionLabel(collection: CollectionConfig): string {
		return humanizeFieldName(collection.labels?.plural || collection.slug);
	}

	/**
	 * Get router path for a collection.
	 */
	getCollectionPath(collection: CollectionConfig): string {
		return `${this.collectionsBasePath()}/${collection.slug}`;
	}

	/**
	 * Get icon name for a collection — checks admin.icon first, then slug mapping, then default.
	 */
	getCollectionIcon(collection: CollectionConfig): string {
		return (
			collection.admin?.icon ||
			this.collectionIcons[collection.slug] ||
			this.collectionIcons['default']
		);
	}

	/**
	 * Get display label for a global.
	 */
	getGlobalLabel(global: GlobalConfig): string {
		return global.label ?? humanizeFieldName(global.slug);
	}

	/**
	 * Get initials from user name.
	 */
	getUserInitials(name: string): string {
		if (!name) return '?';
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	/**
	 * Toggle theme between light and dark.
	 */
	toggleTheme(): void {
		this.theme.toggleTheme();
	}

	/**
	 * Handle sign out click.
	 */
	onSignOutClick(): void {
		this.signOut.emit();
	}
}
