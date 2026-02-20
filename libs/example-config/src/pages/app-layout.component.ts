import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroSun, heroMoon, heroBars3, heroXMark } from '@ng-icons/heroicons/outline';
import { McmsThemeService } from '@momentumcms/admin';

interface NavLink {
	path: string;
	label: string;
	exact: boolean;
}

const NAV_LINKS: NavLink[] = [
	{ path: '/', label: 'Home', exact: true },
	{ path: '/services', label: 'Services', exact: false },
	{ path: '/showcase', label: 'Showcase', exact: false },
	{ path: '/articles', label: 'Articles', exact: false },
	{ path: '/about', label: 'About', exact: false },
	{ path: '/contact', label: 'Contact', exact: false },
];

@Component({
	selector: 'app-layout',
	imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIcon],
	providers: [provideIcons({ heroSun, heroMoon, heroBars3, heroXMark })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'flex flex-col min-h-screen bg-background text-foreground',
	},
	template: `
		<!-- Header -->
		<header
			class="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
			data-testid="app-header"
		>
			<nav class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="flex h-16 items-center justify-between">
					<!-- Logo -->
					<a
						routerLink="/"
						class="text-xl font-bold text-primary hover:text-primary/90 transition-colors"
						data-testid="app-logo"
					>
						Momentum
					</a>

					<!-- Desktop Nav -->
					<div class="hidden md:flex items-center gap-1">
						@for (link of navLinks; track link.path) {
							<a
								[routerLink]="link.path"
								routerLinkActive="text-primary bg-accent"
								[routerLinkActiveOptions]="{ exact: link.exact }"
								class="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
								[attr.data-testid]="'nav-' + link.label.toLowerCase()"
							>
								{{ link.label }}
							</a>
						}
						<a
							routerLink="/admin"
							class="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							data-testid="nav-admin"
						>
							Admin
						</a>

						<!-- Theme toggle -->
						<button
							(click)="toggleTheme()"
							class="ml-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							data-testid="theme-toggle"
							[attr.aria-label]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
						>
							<ng-icon [name]="isDark() ? 'heroSun' : 'heroMoon'" size="20" />
						</button>
					</div>

					<!-- Mobile controls -->
					<div class="flex items-center gap-2 md:hidden">
						<button
							(click)="toggleTheme()"
							class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							[attr.aria-label]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
						>
							<ng-icon [name]="isDark() ? 'heroSun' : 'heroMoon'" size="20" />
						</button>
						<button
							(click)="mobileMenuOpen.set(!mobileMenuOpen())"
							class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							data-testid="mobile-menu-toggle"
							[attr.aria-label]="mobileMenuOpen() ? 'Close menu' : 'Open menu'"
							[attr.aria-expanded]="mobileMenuOpen()"
						>
							<ng-icon [name]="mobileMenuOpen() ? 'heroXMark' : 'heroBars3'" size="24" />
						</button>
					</div>
				</div>

				<!-- Mobile nav drawer -->
				@if (mobileMenuOpen()) {
					<div class="md:hidden border-t border-border py-3 space-y-1" data-testid="mobile-menu">
						@for (link of navLinks; track link.path) {
							<a
								[routerLink]="link.path"
								routerLinkActive="text-primary bg-accent"
								[routerLinkActiveOptions]="{ exact: link.exact }"
								class="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
								(click)="mobileMenuOpen.set(false)"
							>
								{{ link.label }}
							</a>
						}
						<a
							routerLink="/admin"
							class="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							(click)="mobileMenuOpen.set(false)"
						>
							Admin
						</a>
					</div>
				}
			</nav>
		</header>

		<!-- Main content -->
		<main class="flex-1">
			<router-outlet />
		</main>

		<!-- Footer -->
		<footer class="border-t border-border bg-card text-card-foreground" data-testid="app-footer">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
				<div class="flex flex-col md:flex-row justify-between gap-8">
					<div>
						<span class="text-lg font-bold text-primary">Momentum CMS</span>
						<p class="mt-2 text-sm text-muted-foreground max-w-xs">
							A headless CMS built with Angular. Define collections in TypeScript, auto-generate
							Admin UI, REST API, and database schema.
						</p>
					</div>
					<div class="flex gap-12">
						<div>
							<h3 class="font-semibold text-sm mb-3">Pages</h3>
							<ul class="space-y-2 text-sm text-muted-foreground">
								@for (link of navLinks; track link.path) {
									<li>
										<a [routerLink]="link.path" class="hover:text-foreground transition-colors">
											{{ link.label }}
										</a>
									</li>
								}
							</ul>
						</div>
						<div>
							<h3 class="font-semibold text-sm mb-3">Admin</h3>
							<ul class="space-y-2 text-sm text-muted-foreground">
								<li>
									<a routerLink="/admin" class="hover:text-foreground transition-colors">
										Dashboard
									</a>
								</li>
							</ul>
						</div>
					</div>
				</div>
				<div class="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
					&copy; 2026 Momentum CMS. Built with Angular.
				</div>
			</div>
		</footer>
	`,
})
export class AppLayoutComponent {
	private readonly theme = inject(McmsThemeService);
	readonly isDark = this.theme.isDark;
	readonly mobileMenuOpen = signal(false);
	readonly navLinks = NAV_LINKS;

	toggleTheme(): void {
		this.theme.toggleTheme();
	}
}
