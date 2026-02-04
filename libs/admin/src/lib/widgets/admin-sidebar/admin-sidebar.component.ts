import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { CollectionConfig } from '@momentum-cms/core';
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
} from '@momentum-cms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroSquares2x2,
	heroNewspaper,
	heroUsers,
	heroPhoto,
	heroDocument,
	heroFolder,
	heroBolt,
	heroChevronUpDown,
} from '@ng-icons/heroicons/outline';
import type { AdminBranding, AdminUser } from '../widget.types';
import { McmsThemeService } from '../../ui/theme/theme.service';

/**
 * Admin Sidebar Widget
 *
 * CMS-specific sidebar with collection navigation and user section.
 * Composes UI library Sidebar components with Momentum CMS logic.
 *
 * @example
 * ```html
 * <mcms-admin-sidebar
 *   [branding]="{ title: 'My CMS', logo: '/logo.svg' }"
 *   [collections]="collections"
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
	],
	providers: [
		provideIcons({
			heroSquares2x2,
			heroNewspaper,
			heroUsers,
			heroPhoto,
			heroDocument,
			heroFolder,
			heroBolt,
			heroChevronUpDown,
		}),
	],
	host: {
		class: 'shrink-0',
	},
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-sidebar [collapsed]="collapsed()" [width]="width()">
			<!-- Header -->
			<div mcmsSidebarHeader>
				<div class="flex items-center gap-3">
					@if (branding()?.logo) {
						<img [src]="branding()!.logo" alt="Logo" class="h-8 w-8" />
					} @else {
						<!-- Default logo icon -->
						<div
							class="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0"
						>
							<ng-icon
								name="heroBolt"
								class="text-sidebar-primary-foreground"
								size="20"
								aria-hidden="true"
							/>
						</div>
					}
					<h1 class="text-lg font-bold tracking-tight">
						{{ branding()?.title || 'Momentum CMS' }}
					</h1>
				</div>
			</div>

			<!-- Navigation -->
			<div mcmsSidebarContent>
				<mcms-sidebar-nav>
					<!-- Dashboard -->
					<mcms-sidebar-nav-item
						label="Dashboard"
						[href]="basePath()"
						icon="heroSquares2x2"
						[exact]="true"
					/>

					<!-- Collections Section -->
					<mcms-sidebar-section title="Collections">
						@for (collection of collections(); track collection.slug) {
							<mcms-sidebar-nav-item
								[label]="getCollectionLabel(collection)"
								[href]="getCollectionPath(collection)"
								[icon]="getCollectionIcon(collection)"
							/>
						}
						@if (collections().length === 0) {
							<p class="px-3 py-2 text-sm text-muted-foreground">No collections available</p>
						}
					</mcms-sidebar-section>
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
					>
						<mcms-avatar size="sm">
							<mcms-avatar-fallback [delayMs]="0">
								{{ getUserInitials(u.name) }}
							</mcms-avatar-fallback>
						</mcms-avatar>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{{ u.name }}</p>
							<p class="text-xs text-muted-foreground truncate">{{ u.email }}</p>
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

	/** Collections to display in navigation */
	readonly collections = input<CollectionConfig[]>([]);

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

	/** Collection icon names by slug */
	private readonly collectionIcons: Record<string, string> = {
		posts: 'heroNewspaper',
		users: 'heroUsers',
		media: 'heroPhoto',
		pages: 'heroDocument',
		default: 'heroFolder',
	};

	/**
	 * Get display label for a collection.
	 */
	getCollectionLabel(collection: CollectionConfig): string {
		return collection.labels?.plural || collection.slug;
	}

	/**
	 * Get router path for a collection.
	 */
	getCollectionPath(collection: CollectionConfig): string {
		return `${this.collectionsBasePath()}/${collection.slug}`;
	}

	/**
	 * Get icon name for a collection based on its slug.
	 */
	getCollectionIcon(collection: CollectionConfig): string {
		return this.collectionIcons[collection.slug] || this.collectionIcons['default'];
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
