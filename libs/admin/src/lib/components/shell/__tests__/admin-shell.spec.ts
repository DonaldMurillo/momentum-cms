import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { PLATFORM_ID, signal, computed, Component } from '@angular/core';
import { SidebarService } from '@momentumcms/ui';
import { AdminShellComponent } from '../admin-shell.component';
import { MomentumAuthService } from '../../../services/auth.service';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { EntitySheetService } from '../../../services/entity-sheet.service';

@Component({ selector: 'mcms-admin-sidebar', template: '' })
class MockAdminSidebar {}

@Component({ selector: 'mcms-entity-sheet-content', template: '' })
class MockEntitySheetContent {}

@Component({ selector: 'mcms-sidebar-trigger', template: '' })
class MockSidebarTrigger {}

@Component({ selector: 'mcms-toast-container', template: '' })
class MockToastContainer {}

const mockCollections = [
	{
		slug: 'posts',
		fields: [],
		labels: { singular: 'Post', plural: 'Posts' },
	},
	{
		slug: 'hidden-col',
		fields: [],
		labels: { singular: 'Hidden', plural: 'Hidden' },
		admin: { hidden: true },
	},
];

const mockGlobals = [{ slug: 'site-settings', fields: [], label: 'Site Settings' }];

const mockBranding = { title: 'My CMS', logo: '/logo.png' };

class MockAuthService {
	readonly user = signal<{ id: string; email: string; role: string; name: string } | null>(null);
	readonly loading = signal(false);
	readonly isAuthenticated = signal(true);
	needsSetup = vi.fn().mockReturnValue(false);
	initialize = vi.fn().mockResolvedValue(undefined);
	signOut = vi.fn().mockResolvedValue(undefined);
}

class MockCollectionAccessService {
	readonly accessibleCollections = signal<string[]>(['posts']);
	readonly initialized = signal(true);
	loadAccess = vi.fn();
}

class MockEntitySheetService {
	readonly isOpen = signal(false);
	readonly isClosing = signal(false);
	readonly isVisible = computed(() => this.isOpen() || this.isClosing());
	close = vi.fn();
	initFromQueryParams = vi.fn();
}

class MockSidebarService {
	setupKeyboardShortcuts = vi.fn();
}

describe('AdminShellComponent', () => {
	let fixture: ComponentFixture<AdminShellComponent>;
	let component: AdminShellComponent;
	let router: Router;
	let mockAuth: MockAuthService;
	let mockCollectionAccess: MockCollectionAccessService;
	let mockSheet: MockEntitySheetService;
	let mockSidebar: MockSidebarService;

	beforeEach(async () => {
		mockAuth = new MockAuthService();
		mockCollectionAccess = new MockCollectionAccessService();
		mockSheet = new MockEntitySheetService();
		mockSidebar = new MockSidebarService();

		await TestBed.configureTestingModule({
			imports: [AdminShellComponent],
			providers: [
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: {
							data: {
								collections: mockCollections,
								globals: mockGlobals,
								branding: mockBranding,
								pluginRoutes: [{ path: 'analytics', label: 'Analytics' }],
							},
						},
					},
				},
				{ provide: MomentumAuthService, useValue: mockAuth },
				{ provide: CollectionAccessService, useValue: mockCollectionAccess },
				{ provide: EntitySheetService, useValue: mockSheet },
				{ provide: SidebarService, useValue: mockSidebar },
			],
		})
			.overrideComponent(AdminShellComponent, {
				set: {
					imports: [
						MockAdminSidebar,
						MockSidebarTrigger,
						MockEntitySheetContent,
						MockToastContainer,
					],
					template: '<div></div>',
				},
			})
			.compileComponents();

		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture = TestBed.createComponent(AdminShellComponent);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should resolve collections from route data', () => {
		const cols = component.collections();
		// Should filter hidden and only show accessible
		expect(cols).toHaveLength(1);
		expect(cols[0].slug).toBe('posts');
	});

	it('should show all non-hidden collections when access not initialized', () => {
		mockCollectionAccess.initialized.set(false);
		const cols = component.collections();
		expect(cols).toHaveLength(1); // 'hidden-col' is filtered by admin.hidden
		expect(cols[0].slug).toBe('posts');
	});

	it('should resolve globals from route data', () => {
		const globals = component.globals();
		expect(globals).toHaveLength(1);
		expect(globals[0].slug).toBe('site-settings');
	});

	it('should resolve plugin routes from route data', () => {
		const routes = component.pluginRoutes();
		expect(routes).toHaveLength(1);
	});

	it('should resolve branding from route data', () => {
		const branding = component.sidebarBranding();
		expect(branding).toEqual({ title: 'My CMS', logo: '/logo.png' });
	});

	it('should return null sidebarUser when no user', () => {
		expect(component.sidebarUser()).toBeNull();
	});

	it('should return sidebarUser when user exists', () => {
		mockAuth.user.set({ id: '1', email: 'a@b.com', role: 'admin', name: 'Admin' });
		expect(component.sidebarUser()).toEqual({
			id: '1',
			email: 'a@b.com',
			role: 'admin',
			name: 'Admin',
		});
	});

	describe('ngOnInit (browser)', () => {
		it('should setup keyboard shortcuts', () => {
			component.ngOnInit();
			expect(mockSidebar.setupKeyboardShortcuts).toHaveBeenCalled();
		});

		it('should init sheet from query params', () => {
			component.ngOnInit();
			expect(mockSheet.initFromQueryParams).toHaveBeenCalled();
		});

		it('should redirect to setup if needsSetup', async () => {
			mockAuth.needsSetup.mockReturnValue(true);
			component.ngOnInit();
			await vi.waitFor(() => {
				expect(router.navigate).toHaveBeenCalledWith(['/admin/setup']);
			});
		});

		it('should redirect to login if not authenticated', async () => {
			mockAuth.isAuthenticated.set(false);
			component.ngOnInit();
			await vi.waitFor(() => {
				expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
			});
		});

		it('should load collection access if not initialized', async () => {
			mockCollectionAccess.initialized.set(false);
			component.ngOnInit();
			await vi.waitFor(() => {
				expect(mockCollectionAccess.loadAccess).toHaveBeenCalled();
			});
		});

		it('should call initialize when auth is loading', async () => {
			mockAuth.loading.set(true);
			component.ngOnInit();
			await vi.waitFor(() => {
				expect(mockAuth.initialize).toHaveBeenCalled();
			});
		});
	});

	describe('ngOnInit (server)', () => {
		it('should be a no-op on server', async () => {
			await TestBed.resetTestingModule()
				.configureTestingModule({
					imports: [AdminShellComponent],
					providers: [
						provideRouter([]),
						{ provide: PLATFORM_ID, useValue: 'server' },
						{
							provide: ActivatedRoute,
							useValue: { snapshot: { data: {} } },
						},
						{ provide: MomentumAuthService, useValue: mockAuth },
						{ provide: CollectionAccessService, useValue: mockCollectionAccess },
						{ provide: EntitySheetService, useValue: mockSheet },
						{ provide: SidebarService, useValue: mockSidebar },
					],
				})
				.overrideComponent(AdminShellComponent, {
					set: {
						imports: [
							MockAdminSidebar,
							MockSidebarTrigger,
							MockEntitySheetContent,
							MockToastContainer,
						],
						template: '<div></div>',
					},
				})
				.compileComponents();

			const fix = TestBed.createComponent(AdminShellComponent);
			fix.componentInstance.ngOnInit();

			expect(mockSidebar.setupKeyboardShortcuts).not.toHaveBeenCalled();
			expect(mockSheet.initFromQueryParams).not.toHaveBeenCalled();
		});
	});

	describe('onEscapeKey', () => {
		it('should close sheet when open and not closing', () => {
			mockSheet.isOpen.set(true);
			component.onEscapeKey();
			expect(mockSheet.close).toHaveBeenCalled();
		});

		it('should not close sheet when already closing', () => {
			mockSheet.isOpen.set(true);
			mockSheet.isClosing.set(true);
			component.onEscapeKey();
			expect(mockSheet.close).not.toHaveBeenCalled();
		});

		it('should not close sheet when not open', () => {
			component.onEscapeKey();
			expect(mockSheet.close).not.toHaveBeenCalled();
		});
	});

	describe('onSheetBackdropClick', () => {
		it('should close sheet when not closing', () => {
			mockSheet.isOpen.set(true);
			component.onSheetBackdropClick();
			expect(mockSheet.close).toHaveBeenCalled();
		});

		it('should not close when already closing', () => {
			mockSheet.isClosing.set(true);
			component.onSheetBackdropClick();
			expect(mockSheet.close).not.toHaveBeenCalled();
		});
	});

	describe('onSignOut', () => {
		it('should call auth signOut and navigate to login', async () => {
			await component.onSignOut();
			expect(mockAuth.signOut).toHaveBeenCalled();
			expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
		});
	});
});
