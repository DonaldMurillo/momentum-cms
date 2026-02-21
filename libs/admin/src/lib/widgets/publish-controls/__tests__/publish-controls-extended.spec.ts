import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublishControlsWidget } from '../publish-controls.component';
import { VersionService } from '../../../services/version.service';
import { FeedbackService } from '../../feedback/feedback.service';

/**
 * Extended coverage tests for PublishControlsWidget.
 *
 * Targets five specific uncovered paths:
 * 1. onPublish catch block (error resets isUpdating)
 * 2. onUnpublish catch block (error resets isUpdating)
 * 3. onUnpublish isUpdating lifecycle (true during operation)
 * 4. Custom documentLabel passed to confirmUnpublish
 * 5. isLoading lifecycle during loadStatus (true during load, false after)
 */
describe('PublishControlsWidget – extended coverage', () => {
	let fixture: ComponentFixture<PublishControlsWidget>;
	let component: PublishControlsWidget;
	let mockVersionService: Record<string, ReturnType<typeof vi.fn>>;
	let mockFeedback: Record<string, ReturnType<typeof vi.fn>>;

	function setup(options?: {
		initialStatus?: 'draft' | 'published';
		documentLabel?: string;
	}): void {
		mockVersionService = {
			getStatus: vi.fn().mockResolvedValue('draft'),
			publish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
			unpublish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
		};
		mockFeedback = {
			confirmUnpublish: vi.fn().mockResolvedValue(true),
		};

		TestBed.configureTestingModule({
			imports: [PublishControlsWidget],
			providers: [
				{ provide: VersionService, useValue: mockVersionService },
				{ provide: FeedbackService, useValue: mockFeedback },
			],
		});

		TestBed.overrideComponent(PublishControlsWidget, {
			set: { template: '', imports: [] },
		});

		fixture = TestBed.createComponent(PublishControlsWidget);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('collection', 'posts');
		fixture.componentRef.setInput('documentId', 'abc123');

		if (options?.initialStatus !== undefined) {
			fixture.componentRef.setInput('initialStatus', options.initialStatus);
		}
		if (options?.documentLabel !== undefined) {
			fixture.componentRef.setInput('documentLabel', options.documentLabel);
		}

		fixture.detectChanges();
	}

	// ============================================
	// 1. onPublish catch block
	// ============================================

	describe('onPublish error handling', () => {
		beforeEach(() => {
			setup({ initialStatus: 'draft' });
		});

		it('should reset isUpdating to false when publish throws', async () => {
			mockVersionService['publish'] = vi.fn().mockRejectedValue(new Error('Server error'));

			await component.onPublish();

			expect(component.isUpdating()).toBe(false);
		});

		it('should not change status when publish throws', async () => {
			mockVersionService['publish'] = vi.fn().mockRejectedValue(new Error('Server error'));

			await component.onPublish();

			expect(component.status()).toBe('draft');
		});

		it('should not emit statusChanged when publish throws', async () => {
			mockVersionService['publish'] = vi.fn().mockRejectedValue(new Error('Server error'));
			const emitSpy = vi.spyOn(component.statusChanged, 'emit');

			await component.onPublish();

			expect(emitSpy).not.toHaveBeenCalled();
		});
	});

	// ============================================
	// 2. onUnpublish catch block
	// ============================================

	describe('onUnpublish error handling', () => {
		beforeEach(() => {
			setup({ initialStatus: 'published' });
		});

		it('should reset isUpdating to false when unpublish throws', async () => {
			mockVersionService['unpublish'] = vi.fn().mockRejectedValue(new Error('Server error'));

			await component.onUnpublish();

			expect(component.isUpdating()).toBe(false);
		});

		it('should not change status when unpublish throws', async () => {
			mockVersionService['unpublish'] = vi.fn().mockRejectedValue(new Error('Server error'));

			await component.onUnpublish();

			expect(component.status()).toBe('published');
		});

		it('should not emit statusChanged when unpublish throws', async () => {
			mockVersionService['unpublish'] = vi.fn().mockRejectedValue(new Error('Server error'));
			const emitSpy = vi.spyOn(component.statusChanged, 'emit');

			await component.onUnpublish();

			expect(emitSpy).not.toHaveBeenCalled();
		});
	});

	// ============================================
	// 3. onUnpublish isUpdating lifecycle
	// ============================================

	describe('onUnpublish isUpdating lifecycle', () => {
		beforeEach(() => {
			setup({ initialStatus: 'published' });
		});

		it('should set isUpdating true during unpublish and false after', async () => {
			let resolveUnpublish!: (value: unknown) => void;
			mockVersionService['unpublish'] = vi.fn(
				() => new Promise((resolve) => (resolveUnpublish = resolve)),
			);
			// confirmUnpublish resolves immediately (default mock returns true)

			const unpublishPromise = component.onUnpublish();

			// confirmUnpublish is async, so we need to let it resolve first
			// before isUpdating is set to true
			await vi.waitFor(() => {
				expect(component.isUpdating()).toBe(true);
			});

			resolveUnpublish({ doc: {}, message: 'ok' });
			await unpublishPromise;

			expect(component.isUpdating()).toBe(false);
		});

		it('should set isUpdating true during unpublish and false after error', async () => {
			let rejectUnpublish!: (reason: unknown) => void;
			mockVersionService['unpublish'] = vi.fn(
				() => new Promise((_resolve, reject) => (rejectUnpublish = reject)),
			);

			const unpublishPromise = component.onUnpublish();

			// confirmUnpublish is async, so we need to let it resolve first
			await vi.waitFor(() => {
				expect(component.isUpdating()).toBe(true);
			});

			rejectUnpublish(new Error('Network failure'));
			await unpublishPromise;

			expect(component.isUpdating()).toBe(false);
		});
	});

	// ============================================
	// 4. Custom documentLabel
	// ============================================

	describe('custom documentLabel', () => {
		it('should pass custom documentLabel to confirmUnpublish', async () => {
			setup({ initialStatus: 'published', documentLabel: 'Blog Post' });

			await component.onUnpublish();

			expect(mockFeedback['confirmUnpublish']).toHaveBeenCalledWith('Blog Post');
		});

		it('should pass default documentLabel when none is provided', async () => {
			setup({ initialStatus: 'published' });

			await component.onUnpublish();

			expect(mockFeedback['confirmUnpublish']).toHaveBeenCalledWith('Document');
		});
	});

	// ============================================
	// 5. isLoading lifecycle during loadStatus
	// ============================================

	describe('isLoading lifecycle during loadStatus', () => {
		it('should set isLoading true while loading and false after success', async () => {
			let resolveGetStatus!: (value: unknown) => void;

			mockVersionService = {
				getStatus: vi.fn(() => new Promise((resolve) => (resolveGetStatus = resolve))),
				publish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
				unpublish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
			};
			mockFeedback = {
				confirmUnpublish: vi.fn().mockResolvedValue(true),
			};

			TestBed.configureTestingModule({
				imports: [PublishControlsWidget],
				providers: [
					{ provide: VersionService, useValue: mockVersionService },
					{ provide: FeedbackService, useValue: mockFeedback },
				],
			});

			TestBed.overrideComponent(PublishControlsWidget, {
				set: { template: '', imports: [] },
			});

			fixture = TestBed.createComponent(PublishControlsWidget);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('collection', 'posts');
			fixture.componentRef.setInput('documentId', 'abc123');
			fixture.detectChanges();

			// The effect triggers loadStatus, which should set isLoading to true
			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(true);
			});

			resolveGetStatus('published');

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			expect(component.status()).toBe('published');
		});

		it('should set isLoading true while loading and false after error', async () => {
			let rejectGetStatus!: (reason: unknown) => void;

			mockVersionService = {
				getStatus: vi.fn(() => new Promise((_resolve, reject) => (rejectGetStatus = reject))),
				publish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
				unpublish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
			};
			mockFeedback = {
				confirmUnpublish: vi.fn().mockResolvedValue(true),
			};

			TestBed.configureTestingModule({
				imports: [PublishControlsWidget],
				providers: [
					{ provide: VersionService, useValue: mockVersionService },
					{ provide: FeedbackService, useValue: mockFeedback },
				],
			});

			TestBed.overrideComponent(PublishControlsWidget, {
				set: { template: '', imports: [] },
			});

			fixture = TestBed.createComponent(PublishControlsWidget);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('collection', 'posts');
			fixture.componentRef.setInput('documentId', 'abc123');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(true);
			});

			rejectGetStatus(new Error('Network error'));

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			// Falls back to draft on error
			expect(component.status()).toBe('draft');
		});
	});
});
