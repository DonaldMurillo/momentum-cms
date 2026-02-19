import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { CollectionConfig } from '@momentumcms/core';
import { AdminSidebarWidget } from './admin-sidebar.component';
import type { AdminBranding, AdminUser } from '../widget.types';
import { McmsThemeService } from '../../ui/theme/theme.service';
import type { AdminPluginRoute } from '../../routes/momentum-admin-routes';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class DummyRouteComponent {}

function createMockThemeService(): Partial<McmsThemeService> {
	return {
		theme: signal<'light' | 'dark' | 'system'>('light'),
		isDark: signal(false),
		toggleTheme: vi.fn(),
		setTheme: vi.fn(),
	};
}

/** Find the <a> element inside a nav item whose text contains `label`. Throws if not found. */
function findNavLink(
	fixture: ComponentFixture<AdminSidebarWidget>,
	label: string,
): HTMLAnchorElement {
	const anchors: HTMLAnchorElement[] = Array.from(
		fixture.nativeElement.querySelectorAll('mcms-sidebar-nav-item a'),
	);
	const match = anchors.find((a) => a.textContent?.trim().includes(label));
	if (!match) {
		throw new Error(`Nav link with label "${label}" not found`);
	}
	return match;
}

/** Whether Angular's routerLinkActive directive has applied the active class. */
function isHighlighted(element: HTMLElement): boolean {
	return element.classList.contains('bg-sidebar-accent');
}

describe('AdminSidebarWidget', () => {
	let fixture: ComponentFixture<AdminSidebarWidget>;
	let component: AdminSidebarWidget;
	let mockThemeService: Partial<McmsThemeService>;

	const mockCollections: CollectionConfig[] = [
		{ slug: 'posts', fields: [], labels: { singular: 'Post', plural: 'Posts' } },
		{ slug: 'users', fields: [], labels: { singular: 'User', plural: 'Users' } },
	];

	const mockUser: AdminUser = {
		id: '1',
		name: 'Test User',
		email: 'test@example.com',
	};

	const mockBranding: AdminBranding = {
		title: 'Test CMS',
		logo: '/logo.svg',
	};

	beforeEach(async () => {
		mockThemeService = createMockThemeService();

		await TestBed.configureTestingModule({
			imports: [AdminSidebarWidget],
			providers: [provideRouter([]), { provide: McmsThemeService, useValue: mockThemeService }],
		}).compileComponents();

		fixture = TestBed.createComponent(AdminSidebarWidget);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should render default title when no branding', () => {
		const title = fixture.nativeElement.querySelector('h1');
		expect(title.textContent).toContain('Momentum CMS');
	});

	it('should render custom branding title', async () => {
		fixture.componentRef.setInput('branding', mockBranding);
		fixture.detectChanges();
		await fixture.whenStable();

		const title = fixture.nativeElement.querySelector('h1');
		expect(title.textContent).toContain('Test CMS');
	});

	it('should render logo when provided', async () => {
		fixture.componentRef.setInput('branding', mockBranding);
		fixture.detectChanges();
		await fixture.whenStable();

		const logo = fixture.nativeElement.querySelector('img');
		expect(logo).toBeTruthy();
		expect(logo.getAttribute('src')).toBe('/logo.svg');
	});

	it('should render dashboard link', () => {
		const dashboardLink = fixture.nativeElement.querySelector('mcms-sidebar-nav-item');
		expect(dashboardLink).toBeTruthy();
	});

	it('should render collection navigation items', async () => {
		fixture.componentRef.setInput('collections', mockCollections);
		fixture.detectChanges();
		await fixture.whenStable();

		const navItems = fixture.nativeElement.querySelectorAll('mcms-sidebar-nav-item');
		// Dashboard + 2 collections
		expect(navItems.length).toBe(3);
	});

	it('should use collection labels for display', async () => {
		fixture.componentRef.setInput('collections', mockCollections);
		fixture.detectChanges();
		await fixture.whenStable();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Posts');
		expect(text).toContain('Users');
	});

	it('should show empty message when no collections', async () => {
		fixture.componentRef.setInput('collections', []);
		fixture.detectChanges();
		await fixture.whenStable();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('No collections available');
	});

	it('should render user info when provided', async () => {
		fixture.componentRef.setInput('user', mockUser);
		fixture.detectChanges();
		await fixture.whenStable();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Test User');
		expect(text).toContain('test@example.com');
	});

	it('should render user dropdown trigger when user is present', async () => {
		fixture.componentRef.setInput('user', mockUser);
		fixture.detectChanges();
		await fixture.whenStable();

		// Look for a button in the sidebar footer containing user info
		const footerContent = fixture.nativeElement.querySelector('[mcmssidebarfooter]');
		const triggerButton = footerContent?.querySelector('button') as HTMLButtonElement;
		expect(triggerButton).toBeTruthy();
		expect(triggerButton.textContent).toContain('Test User');
	});

	it('should emit signOut when sign out is clicked', async () => {
		fixture.componentRef.setInput('user', mockUser);
		fixture.detectChanges();
		await fixture.whenStable();

		const signOutSpy = vi.fn();
		component.signOut.subscribe(signOutSpy);

		// Call the method directly since dropdown interaction is complex in tests
		component.onSignOutClick();

		expect(signOutSpy).toHaveBeenCalled();
	});

	it('should use custom basePath', async () => {
		fixture.componentRef.setInput('basePath', '/dashboard');
		fixture.componentRef.setInput('collections', mockCollections);
		fixture.detectChanges();
		await fixture.whenStable();

		const path = component.getCollectionPath(mockCollections[0]);
		expect(path).toBe('/dashboard/collections/posts');
	});

	it('should return correct collection label', () => {
		const labelWithPlural = component.getCollectionLabel(mockCollections[0]);
		expect(labelWithPlural).toBe('Posts');

		const collectionNoLabel: CollectionConfig = { slug: 'items', fields: [] };
		const labelFromSlug = component.getCollectionLabel(collectionNoLabel);
		expect(labelFromSlug).toBe('Items');
	});
});

describe('AdminSidebarWidget — plugin route active link highlighting', () => {
	let fixture: ComponentFixture<AdminSidebarWidget>;
	let router: Router;

	const analyticsPluginRoutes: AdminPluginRoute[] = [
		{
			path: 'analytics',
			label: 'Analytics',
			icon: 'heroChartBarSquare',
			group: 'Analytics',
			loadComponent: () => Promise.resolve(DummyRouteComponent),
		},
		{
			path: 'analytics/content',
			label: 'Content Perf.',
			icon: 'heroDocumentText',
			group: 'Analytics',
			loadComponent: () => Promise.resolve(DummyRouteComponent),
		},
		{
			path: 'analytics/tracking-rules',
			label: 'Tracking Rules',
			icon: 'heroCursorArrowRays',
			group: 'Analytics',
			loadComponent: () => Promise.resolve(DummyRouteComponent),
		},
	];

	beforeEach(async () => {
		const mockThemeService = createMockThemeService();

		await TestBed.configureTestingModule({
			imports: [AdminSidebarWidget],
			providers: [
				provideRouter([
					{
						path: 'admin',
						children: [
							{ path: 'analytics', component: DummyRouteComponent },
							{ path: 'analytics/content', component: DummyRouteComponent },
							{ path: 'analytics/tracking-rules', component: DummyRouteComponent },
						],
					},
				]),
				{ provide: McmsThemeService, useValue: mockThemeService },
			],
		}).compileComponents();

		router = TestBed.inject(Router);
		fixture = TestBed.createComponent(AdminSidebarWidget);
		fixture.componentRef.setInput('pluginRoutes', analyticsPluginRoutes);
		fixture.componentRef.setInput('basePath', '/admin');
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should highlight only Content Perf. when navigated to /admin/analytics/content', async () => {
		await router.navigateByUrl('/admin/analytics/content');
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const analyticsLink = findNavLink(fixture, 'Analytics');
		const contentLink = findNavLink(fixture, 'Content Perf.');
		const trackingLink = findNavLink(fixture, 'Tracking Rules');

		expect(isHighlighted(analyticsLink)).toBe(false);
		expect(isHighlighted(contentLink)).toBe(true);
		expect(isHighlighted(trackingLink)).toBe(false);
	});

	it('should highlight only Analytics when navigated to /admin/analytics', async () => {
		await router.navigateByUrl('/admin/analytics');
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const analyticsLink = findNavLink(fixture, 'Analytics');
		const contentLink = findNavLink(fixture, 'Content Perf.');
		const trackingLink = findNavLink(fixture, 'Tracking Rules');

		expect(isHighlighted(analyticsLink)).toBe(true);
		expect(isHighlighted(contentLink)).toBe(false);
		expect(isHighlighted(trackingLink)).toBe(false);
	});

	it('should highlight only Tracking Rules when navigated to /admin/analytics/tracking-rules', async () => {
		await router.navigateByUrl('/admin/analytics/tracking-rules');
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const analyticsLink = findNavLink(fixture, 'Analytics');
		const contentLink = findNavLink(fixture, 'Content Perf.');
		const trackingLink = findNavLink(fixture, 'Tracking Rules');

		expect(isHighlighted(analyticsLink)).toBe(false);
		expect(isHighlighted(contentLink)).toBe(false);
		expect(isHighlighted(trackingLink)).toBe(true);
	});
});

describe('AdminSidebarWidget — collection route prefix matching', () => {
	let fixture: ComponentFixture<AdminSidebarWidget>;
	let router: Router;

	const collections: CollectionConfig[] = [
		{ slug: 'posts', fields: [], labels: { singular: 'Post', plural: 'Posts' } },
		{ slug: 'users', fields: [], labels: { singular: 'User', plural: 'Users' } },
	];

	beforeEach(async () => {
		const mockThemeService = createMockThemeService();

		await TestBed.configureTestingModule({
			imports: [AdminSidebarWidget],
			providers: [
				provideRouter([
					{
						path: 'admin',
						children: [
							{ path: 'collections/posts', component: DummyRouteComponent },
							{ path: 'collections/posts/:id', component: DummyRouteComponent },
							{ path: 'collections/users', component: DummyRouteComponent },
						],
					},
				]),
				{ provide: McmsThemeService, useValue: mockThemeService },
			],
		}).compileComponents();

		router = TestBed.inject(Router);
		fixture = TestBed.createComponent(AdminSidebarWidget);
		fixture.componentRef.setInput('collections', collections);
		fixture.componentRef.setInput('basePath', '/admin');
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should keep collection nav item highlighted on sub-routes via prefix matching', async () => {
		await router.navigateByUrl('/admin/collections/posts/123');
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const postsLink = findNavLink(fixture, 'Posts');
		const usersLink = findNavLink(fixture, 'Users');

		expect(isHighlighted(postsLink)).toBe(true);
		expect(isHighlighted(usersLink)).toBe(false);
	});
});
