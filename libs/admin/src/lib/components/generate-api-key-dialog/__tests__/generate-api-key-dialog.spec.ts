import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { DIALOG_DATA } from '@momentumcms/ui';
import {
	GenerateApiKeyDialog,
	type GenerateApiKeyDialogData,
} from '../generate-api-key-dialog.component';
import { MomentumAuthService } from '../../../services/auth.service';

class MockAuthService {
	readonly user = signal<{ role: string } | null>({ role: 'admin' });
	readonly loading = signal(false);
	readonly isAuthenticated = signal(true);
	readonly isAdmin = signal(true);

	role(): string {
		return this.user()?.role ?? 'viewer';
	}
}

describe('GenerateApiKeyDialog', () => {
	let component: GenerateApiKeyDialog;
	let httpMock: HttpTestingController;

	const dialogData: GenerateApiKeyDialogData = {
		endpoint: '/api/auth/api-keys',
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [GenerateApiKeyDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: dialogData },
				{ provide: MomentumAuthService, useClass: MockAuthService },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(GenerateApiKeyDialog);
		component = fixture.componentInstance;
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should have empty initial state', () => {
		expect(component.name()).toBe('');
		expect(component.role()).toBe('user');
		expect(component.submitting()).toBe(false);
		expect(component.errorMessage()).toBe('');
		expect(component.generatedKey()).toBe('');
		expect(component.generatedKeyPrefix()).toBe('');
		expect(component.copied()).toBe(false);
	});

	it('should show all roles for admin users', () => {
		const options = component.roleOptions();
		expect(options.length).toBe(4);
		expect(options.map((o) => o.value)).toEqual(['admin', 'editor', 'user', 'viewer']);
	});

	it('should submit and set generated key on success', async () => {
		component.name.set('CI Pipeline');
		component.role.set('editor');

		const submitPromise = component.submit();

		const req = httpMock.expectOne('/api/auth/api-keys');
		expect(req.request.method).toBe('POST');
		expect(req.request.body).toEqual({ name: 'CI Pipeline', role: 'editor' });
		req.flush({
			id: 'key-1',
			name: 'CI Pipeline',
			key: 'mk_live_abc123',
			keyPrefix: 'mk_live_',
			role: 'editor',
			expiresAt: null,
			createdAt: '2024-01-01',
		});

		await submitPromise;

		expect(component.generatedKey()).toBe('mk_live_abc123');
		expect(component.generatedKeyPrefix()).toBe('mk_live_');
		expect(component.submitting()).toBe(false);
	});

	it('should not submit when name is empty', async () => {
		component.name.set('');
		await component.submit();
		httpMock.expectNone('/api/auth/api-keys');
	});

	it('should not submit when name is whitespace only', async () => {
		component.name.set('   ');
		await component.submit();
		httpMock.expectNone('/api/auth/api-keys');
	});

	it('should set error message on failure', async () => {
		component.name.set('Test Key');

		const submitPromise = component.submit();

		const req = httpMock.expectOne('/api/auth/api-keys');
		req.error(new ProgressEvent('error'));

		await submitPromise;

		expect(component.errorMessage()).toBe('Failed to generate API key. Please try again.');
		expect(component.submitting()).toBe(false);
	});

	it('should set submitting state during request', () => {
		component.name.set('Test Key');
		component.submit();

		expect(component.submitting()).toBe(true);

		const req = httpMock.expectOne('/api/auth/api-keys');
		req.flush({
			id: 'key-1',
			name: 'Test Key',
			key: 'mk_test_xyz',
			keyPrefix: 'mk_test_',
			role: 'user',
			expiresAt: null,
			createdAt: '2024-01-01',
		});
	});
});

describe('GenerateApiKeyDialog - non-admin role options', () => {
	it('should limit roles for editor users', async () => {
		const mockAuth = new MockAuthService();
		mockAuth.user.set({ role: 'editor' });

		await TestBed.configureTestingModule({
			imports: [GenerateApiKeyDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: { endpoint: '/api/auth/api-keys' } },
				{ provide: MomentumAuthService, useValue: mockAuth },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(GenerateApiKeyDialog);
		const component = fixture.componentInstance;

		const options = component.roleOptions();
		// Editor should see editor, user, viewer (not admin)
		expect(options.map((o) => o.value)).toEqual(['editor', 'user', 'viewer']);
	});

	it('should show only viewer for viewer users', async () => {
		const mockAuth = new MockAuthService();
		mockAuth.user.set({ role: 'viewer' });

		await TestBed.configureTestingModule({
			imports: [GenerateApiKeyDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: { endpoint: '/api/auth/api-keys' } },
				{ provide: MomentumAuthService, useValue: mockAuth },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(GenerateApiKeyDialog);
		const component = fixture.componentInstance;

		const options = component.roleOptions();
		expect(options.map((o) => o.value)).toEqual(['viewer']);
	});

	it('should fallback to viewer for unknown role', async () => {
		const mockAuth = new MockAuthService();
		mockAuth.user.set({ role: 'unknown' });

		await TestBed.configureTestingModule({
			imports: [GenerateApiKeyDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: { endpoint: '/api/auth/api-keys' } },
				{ provide: MomentumAuthService, useValue: mockAuth },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(GenerateApiKeyDialog);
		const component = fixture.componentInstance;

		const options = component.roleOptions();
		expect(options).toHaveLength(1);
		expect(options[0].value).toBe('viewer');
	});
});
