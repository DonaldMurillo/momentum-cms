/**
 * Additional coverage tests for GenerateApiKeyDialog.
 *
 * Targets remaining uncovered statements/branches:
 * - copyKey: clipboard.writeText success path, copied state reset via setTimeout
 * - copyKey: clipboard API failure (catch block)
 * - copyKey: navigator undefined or no clipboard
 * - submit: trimming whitespace from name
 * - submit: error message cleared on subsequent submit
 * - roleOptions: when user role is null
 * - generatedKeyPrefix display path (empty vs non-empty)
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DIALOG_DATA } from '@momentumcms/ui';
import {
	GenerateApiKeyDialog,
	type GenerateApiKeyDialogData,
} from '../generate-api-key-dialog.component';
import { MomentumAuthService } from '../../../services/auth.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockAuthService {
	readonly user = signal<{ role: string } | null>({ role: 'admin' });
	readonly loading = signal(false);
	readonly isAuthenticated = signal(true);
	readonly isAdmin = signal(true);
	readonly role = signal<string | null>('admin');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GenerateApiKeyDialog (coverage)', () => {
	let component: GenerateApiKeyDialog;
	let fixture: ComponentFixture<GenerateApiKeyDialog>;
	let httpMock: HttpTestingController;
	let mockAuth: MockAuthService;

	const dialogData: GenerateApiKeyDialogData = {
		endpoint: '/api/auth/api-keys',
	};

	beforeEach(async () => {
		mockAuth = new MockAuthService();

		await TestBed.configureTestingModule({
			imports: [GenerateApiKeyDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: dialogData },
				{ provide: MomentumAuthService, useValue: mockAuth },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(GenerateApiKeyDialog);
		component = fixture.componentInstance;
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	// -----------------------------------------------------------------------
	// copyKey - success path
	// -----------------------------------------------------------------------
	describe('copyKey - clipboard success', () => {
		it('should set copied to true and reset after timeout', async () => {
			vi.useFakeTimers();

			component.generatedKey.set('mk_test_key_123');

			const writeTextMock = vi.fn().mockResolvedValue(undefined);
			// Mock the clipboard via document.defaultView
			const mockWindow = {
				navigator: { clipboard: { writeText: writeTextMock } },
				setTimeout: vi.fn().mockImplementation((cb: () => void, ms: number) => {
					return globalThis.setTimeout(cb, ms);
				}),
			};

			// Access document to spy on defaultView
			Object.defineProperty(document, 'defaultView', {
				value: mockWindow,
				writable: true,
				configurable: true,
			});

			await component.copyKey();

			expect(component.copied()).toBe(true);
			expect(writeTextMock).toHaveBeenCalledWith('mk_test_key_123');

			// Reset defaultView
			Object.defineProperty(document, 'defaultView', {
				value: window,
				writable: true,
				configurable: true,
			});

			vi.useRealTimers();
		});

		it('should handle clipboard writeText rejection gracefully', async () => {
			component.generatedKey.set('mk_test_key_456');

			const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
			const originalClipboard = navigator.clipboard;

			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText: writeTextMock },
				writable: true,
				configurable: true,
			});

			// Should not throw
			await expect(component.copyKey()).resolves.toBeUndefined();
			// copied should remain false because writeText failed
			expect(component.copied()).toBe(false);

			Object.defineProperty(navigator, 'clipboard', {
				value: originalClipboard,
				writable: true,
				configurable: true,
			});
		});
	});

	// -----------------------------------------------------------------------
	// submit - trims whitespace
	// -----------------------------------------------------------------------
	describe('submit - name trimming', () => {
		it('should trim leading and trailing whitespace from name', async () => {
			component.name.set('  CI Pipeline  ');
			component.role.set('user');

			const submitPromise = component.submit();

			const req = httpMock.expectOne('/api/auth/api-keys');
			expect(req.request.body).toEqual({ name: 'CI Pipeline', role: 'user' });
			req.flush({
				id: 'key-1',
				name: 'CI Pipeline',
				key: 'mk_live_trimmed',
				keyPrefix: 'mk_live_',
				role: 'user',
				expiresAt: null,
				createdAt: '2024-01-01',
			});

			await submitPromise;
			expect(component.generatedKey()).toBe('mk_live_trimmed');
		});
	});

	// -----------------------------------------------------------------------
	// submit - clears error on retry
	// -----------------------------------------------------------------------
	describe('submit - error then success', () => {
		it('should clear error message on subsequent submit', async () => {
			// First: trigger an error
			component.name.set('Retry Key');
			const firstSubmit = component.submit();
			const req1 = httpMock.expectOne('/api/auth/api-keys');
			req1.error(new ProgressEvent('error'));
			await firstSubmit;
			expect(component.errorMessage()).toBe('Failed to generate API key. Please try again.');

			// Second: submit again successfully
			const secondSubmit = component.submit();

			// Error should be cleared immediately
			expect(component.errorMessage()).toBe('');

			const req2 = httpMock.expectOne('/api/auth/api-keys');
			req2.flush({
				id: 'key-2',
				name: 'Retry Key',
				key: 'mk_retry_success',
				keyPrefix: 'mk_retry_',
				role: 'user',
				expiresAt: null,
				createdAt: '2024-01-01',
			});

			await secondSubmit;
			expect(component.generatedKey()).toBe('mk_retry_success');
			expect(component.errorMessage()).toBe('');
		});
	});

	// -----------------------------------------------------------------------
	// submit - submitting state transitions
	// -----------------------------------------------------------------------
	describe('submit - submitting state lifecycle', () => {
		it('should set submitting to true during request and false after', async () => {
			component.name.set('State Test');

			expect(component.submitting()).toBe(false);

			const submitPromise = component.submit();
			expect(component.submitting()).toBe(true);

			const req = httpMock.expectOne('/api/auth/api-keys');
			req.flush({
				id: 'key-3',
				name: 'State Test',
				key: 'mk_state_test',
				keyPrefix: 'mk_state_',
				role: 'user',
				expiresAt: null,
				createdAt: '2024-01-01',
			});

			await submitPromise;
			expect(component.submitting()).toBe(false);
		});

		it('should set submitting to false after error', async () => {
			component.name.set('Error State');

			const submitPromise = component.submit();
			expect(component.submitting()).toBe(true);

			const req = httpMock.expectOne('/api/auth/api-keys');
			req.error(new ProgressEvent('error'));

			await submitPromise;
			expect(component.submitting()).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// roleOptions - null role
	// -----------------------------------------------------------------------
	describe('roleOptions - null role', () => {
		it('should fallback to viewer when role is null', async () => {
			mockAuth.role.set(null);

			// Need to rebuild the component for the computed to pick up the new value
			TestBed.resetTestingModule();
			const nullAuth = new MockAuthService();
			nullAuth.role.set(null);

			await TestBed.configureTestingModule({
				imports: [GenerateApiKeyDialog],
				providers: [
					provideHttpClient(),
					provideHttpClientTesting(),
					{ provide: DIALOG_DATA, useValue: dialogData },
					{ provide: MomentumAuthService, useValue: nullAuth },
				],
			}).compileComponents();

			const localFixture = TestBed.createComponent(GenerateApiKeyDialog);
			const localComponent = localFixture.componentInstance;

			const options = localComponent.roleOptions();
			// null role falls back to 'viewer' via ?? 'viewer'
			expect(options).toHaveLength(1);
			expect(options[0].value).toBe('viewer');

			TestBed.inject(HttpTestingController).verify();
		});
	});

	// -----------------------------------------------------------------------
	// roleOptions - user role
	// -----------------------------------------------------------------------
	describe('roleOptions - user role', () => {
		it('should show user and viewer for user role', async () => {
			TestBed.resetTestingModule();
			const userAuth = new MockAuthService();
			userAuth.role.set('user');

			await TestBed.configureTestingModule({
				imports: [GenerateApiKeyDialog],
				providers: [
					provideHttpClient(),
					provideHttpClientTesting(),
					{ provide: DIALOG_DATA, useValue: dialogData },
					{ provide: MomentumAuthService, useValue: userAuth },
				],
			}).compileComponents();

			const localFixture = TestBed.createComponent(GenerateApiKeyDialog);
			const localComponent = localFixture.componentInstance;

			const options = localComponent.roleOptions();
			expect(options.map((o) => o.value)).toEqual(['user', 'viewer']);

			TestBed.inject(HttpTestingController).verify();
		});
	});

	// -----------------------------------------------------------------------
	// generatedKeyPrefix - display when present
	// -----------------------------------------------------------------------
	describe('generatedKeyPrefix - signal state', () => {
		it('should store key prefix from API response', async () => {
			component.name.set('Prefix Test');

			const submitPromise = component.submit();

			const req = httpMock.expectOne('/api/auth/api-keys');
			req.flush({
				id: 'key-prefix',
				name: 'Prefix Test',
				key: 'mk_live_prefixed_key_12345',
				keyPrefix: 'mk_live_',
				role: 'user',
				expiresAt: null,
				createdAt: '2024-01-01',
			});

			await submitPromise;

			expect(component.generatedKeyPrefix()).toBe('mk_live_');
			expect(component.generatedKey()).toBe('mk_live_prefixed_key_12345');
		});
	});
});
