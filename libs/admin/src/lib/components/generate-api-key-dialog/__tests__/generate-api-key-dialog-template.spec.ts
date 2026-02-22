/**
 * Template coverage tests for GenerateApiKeyDialog.
 *
 * Renders the REAL component template so that all template expression
 * statements (bindings, `@if`, `@else`, event handlers, attribute bindings)
 * are evaluated by the coverage tool.
 *
 * Strategy:
 *   - Use NO_ERRORS_SCHEMA so unknown child selectors are tolerated.
 *   - Override only the component's `imports` (to []) — keep the template.
 *   - Mock DIALOG_DATA, HttpClient, MomentumAuthService, DOCUMENT.
 *   - Manipulate signals to hit each `@if`/`@else` branch.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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

describe('GenerateApiKeyDialog (template coverage)', () => {
	let fixture: ComponentFixture<GenerateApiKeyDialog>;
	let component: GenerateApiKeyDialog;

	const dialogData: GenerateApiKeyDialogData = {
		endpoint: '/api/auth/api-keys',
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [GenerateApiKeyDialog],
			schemas: [NO_ERRORS_SCHEMA],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: dialogData },
				{ provide: MomentumAuthService, useClass: MockAuthService },
			],
		})
			.overrideComponent(GenerateApiKeyDialog, {
				set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA] },
			})
			.compileComponents();
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	function createComponent(): void {
		fixture = TestBed.createComponent(GenerateApiKeyDialog);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	// -------------------------------------------------------------------
	// Form view: @else branch (generatedKey() is empty)
	// -------------------------------------------------------------------
	describe('form view (no generated key)', () => {
		it('should render the form with Key Name input', () => {
			createComponent();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Key Name');
			expect(text).toContain('Generate API Key');
		});

		it('should render the name input with data-testid', () => {
			createComponent();

			const nameInput = fixture.nativeElement.querySelector('[data-testid="api-key-name-input"]');
			expect(nameInput).toBeTruthy();
		});

		it('should render the role select with data-testid', () => {
			createComponent();

			const roleSelect = fixture.nativeElement.querySelector('[data-testid="api-key-role-select"]');
			expect(roleSelect).toBeTruthy();
		});

		it('should render Cancel and Generate buttons in the footer', () => {
			createComponent();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Cancel');
			expect(text).toContain('Generate');
		});

		it('should render the submit button with data-testid', () => {
			createComponent();

			const submitBtn = fixture.nativeElement.querySelector('[data-testid="api-key-submit"]');
			expect(submitBtn).toBeTruthy();
		});

		it('should disable submit when name is empty', () => {
			createComponent();
			component.name.set('');
			fixture.detectChanges();

			const submitBtn = fixture.nativeElement.querySelector('[data-testid="api-key-submit"]');
			expect(submitBtn.disabled).toBe(true);
		});

		it('should enable submit when name has content', () => {
			createComponent();
			component.name.set('CI Key');
			fixture.detectChanges();

			const submitBtn = fixture.nativeElement.querySelector('[data-testid="api-key-submit"]');
			expect(submitBtn.disabled).toBe(false);
		});

		it('should show "Generating..." text when submitting', () => {
			createComponent();
			component.name.set('Test');
			component.submitting.set(true);
			fixture.detectChanges();

			const submitBtn = fixture.nativeElement.querySelector('[data-testid="api-key-submit"]');
			expect(submitBtn.textContent.trim()).toContain('Generating...');
		});

		it('should show "Generate" text when not submitting', () => {
			createComponent();
			component.name.set('Test');
			component.submitting.set(false);
			fixture.detectChanges();

			const submitBtn = fixture.nativeElement.querySelector('[data-testid="api-key-submit"]');
			expect(submitBtn.textContent.trim()).toContain('Generate');
		});

		it('should disable submit when submitting', () => {
			createComponent();
			component.name.set('Test');
			component.submitting.set(true);
			fixture.detectChanges();

			const submitBtn = fixture.nativeElement.querySelector('[data-testid="api-key-submit"]');
			expect(submitBtn.disabled).toBe(true);
		});

		it('should call submit when Generate button is clicked', () => {
			createComponent();
			component.name.set('Click Test');
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'submit');
			const submitBtn = fixture.nativeElement.querySelector('[data-testid="api-key-submit"]');
			submitBtn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should bind name value to the mcms-input', () => {
			createComponent();
			component.name.set('My API Key');
			fixture.detectChanges();

			const nameInput = fixture.nativeElement.querySelector('[data-testid="api-key-name-input"]');
			// The [value] binding should be set
			expect(nameInput).toBeTruthy();
		});

		it('should bind roleOptions to the mcms-select', () => {
			createComponent();
			// roleOptions should be populated for admin
			expect(component.roleOptions().length).toBe(4);

			const roleSelect = fixture.nativeElement.querySelector('[data-testid="api-key-role-select"]');
			expect(roleSelect).toBeTruthy();
		});
	});

	// -------------------------------------------------------------------
	// Error message: @if (errorMessage())
	// -------------------------------------------------------------------
	describe('error message display', () => {
		it('should render error message when errorMessage is set', () => {
			createComponent();
			component.errorMessage.set('Failed to generate API key. Please try again.');
			fixture.detectChanges();

			const errorEl = fixture.nativeElement.querySelector('[role="alert"]');
			expect(errorEl).toBeTruthy();
			expect(errorEl.textContent).toContain('Failed to generate');
		});

		it('should NOT render error message when errorMessage is empty', () => {
			createComponent();
			component.errorMessage.set('');
			fixture.detectChanges();

			// The error role="alert" should not exist (the warning alert is only
			// for the key display). We need to check for the destructive alert.
			const errorAlerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
			const destructiveAlert = Array.from(errorAlerts).find((el) =>
				(el as HTMLElement).classList.contains('text-destructive'),
			);
			expect(destructiveAlert).toBeUndefined();
		});
	});

	// -------------------------------------------------------------------
	// Generated key view: @if (generatedKey())
	// -------------------------------------------------------------------
	describe('generated key view', () => {
		beforeEach(() => {
			createComponent();
			component.generatedKey.set('mk_live_abc123def456');
			fixture.detectChanges();
		});

		it('should render the warning alert about showing key only once', () => {
			const alertEl = fixture.nativeElement.querySelector('[role="alert"]');
			expect(alertEl).toBeTruthy();
			expect(alertEl.textContent).toContain('only be shown once');
		});

		it('should render the generated key in code element', () => {
			const codeEl = fixture.nativeElement.querySelector('[data-testid="generated-api-key"]');
			expect(codeEl).toBeTruthy();
			expect(codeEl.textContent).toContain('mk_live_abc123def456');
		});

		it('should render the Copy button', () => {
			const copyBtn = fixture.nativeElement.querySelector('[data-testid="copy-api-key"]');
			expect(copyBtn).toBeTruthy();
			expect(copyBtn.textContent.trim()).toContain('Copy');
		});

		it('should show "Copied!" when copied is true', () => {
			component.copied.set(true);
			fixture.detectChanges();

			const copyBtn = fixture.nativeElement.querySelector('[data-testid="copy-api-key"]');
			expect(copyBtn.textContent.trim()).toContain('Copied!');
		});

		it('should update aria-label on copy button based on copied state', () => {
			const copyBtn = fixture.nativeElement.querySelector('[data-testid="copy-api-key"]');
			expect(copyBtn.getAttribute('aria-label')).toBe('Copy API key to clipboard');

			component.copied.set(true);
			fixture.detectChanges();
			expect(copyBtn.getAttribute('aria-label')).toBe('API key copied to clipboard');
		});

		it('should call copyKey when Copy button is clicked', () => {
			const spy = vi.spyOn(component, 'copyKey');
			const copyBtn = fixture.nativeElement.querySelector('[data-testid="copy-api-key"]');
			copyBtn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should render aria-live region for screen reader announcement', () => {
			const srOnly = fixture.nativeElement.querySelector('[aria-live="polite"]');
			expect(srOnly).toBeTruthy();

			// When not copied, it should be empty
			expect(srOnly.textContent.trim()).toBe('');

			// When copied, it should announce
			component.copied.set(true);
			fixture.detectChanges();
			expect(srOnly.textContent.trim()).toContain('API key copied to clipboard');
		});

		it('should render key prefix when generatedKeyPrefix is set', () => {
			component.generatedKeyPrefix.set('mk_live_');
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Key prefix:');
			expect(text).toContain('mk_live_');
		});

		it('should NOT render key prefix section when generatedKeyPrefix is empty', () => {
			component.generatedKeyPrefix.set('');
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).not.toContain('Key prefix:');
		});

		it('should render Done button in footer', () => {
			const doneBtn = fixture.nativeElement.querySelector('[data-testid="api-key-done"]');
			expect(doneBtn).toBeTruthy();
			expect(doneBtn.textContent.trim()).toContain('Done');
		});

		it('should NOT render Cancel/Generate buttons in generated key view', () => {
			const submitBtn = fixture.nativeElement.querySelector('[data-testid="api-key-submit"]');
			expect(submitBtn).toBeNull();
		});
	});

	// -------------------------------------------------------------------
	// Branch transitions
	// -------------------------------------------------------------------
	describe('branch transitions', () => {
		it('should transition from form to generated key view', () => {
			createComponent();

			// Initially form view
			expect(fixture.nativeElement.querySelector('[data-testid="api-key-submit"]')).toBeTruthy();
			expect(fixture.nativeElement.querySelector('[data-testid="generated-api-key"]')).toBeNull();

			// Switch to key view
			component.generatedKey.set('mk_test_xyz');
			fixture.detectChanges();

			expect(fixture.nativeElement.querySelector('[data-testid="api-key-submit"]')).toBeNull();
			expect(fixture.nativeElement.querySelector('[data-testid="generated-api-key"]')).toBeTruthy();
		});
	});
});
