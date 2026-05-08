import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogService } from '@momentumcms/ui';
import { PublishControlsWidget } from '../publish-controls.component';
import { VersionService } from '../../../services/version.service';
import { FeedbackService } from '../../feedback/feedback.service';

describe('PublishControlsWidget', () => {
	let fixture: ComponentFixture<PublishControlsWidget>;
	let component: PublishControlsWidget;
	let mockVersionService: Record<string, ReturnType<typeof vi.fn>>;
	let mockFeedback: Record<string, ReturnType<typeof vi.fn>>;
	let mockDialogService: Record<string, ReturnType<typeof vi.fn>>;

	function setup(initialStatus?: 'draft' | 'published'): void {
		mockVersionService = {
			getStatus: vi.fn().mockResolvedValue('draft'),
			publish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
			unpublish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
			schedulePublish: vi
				.fn()
				.mockResolvedValue({ id: 'abc123', scheduledPublishAt: '2099-01-01T00:00:00.000Z' }),
			cancelScheduledPublish: vi.fn().mockResolvedValue({ message: 'ok' }),
			getScheduledPublishAt: vi.fn().mockResolvedValue(null),
		};
		mockFeedback = {
			confirmUnpublish: vi.fn().mockResolvedValue(true),
			confirmCancelSchedule: vi.fn().mockResolvedValue(true),
			publishScheduled: vi.fn(),
			scheduledPublishCancelled: vi.fn(),
			operationFailed: vi.fn(),
		};
		mockDialogService = {
			open: vi.fn(),
		};

		TestBed.configureTestingModule({
			imports: [PublishControlsWidget],
			providers: [
				{ provide: VersionService, useValue: mockVersionService },
				{ provide: FeedbackService, useValue: mockFeedback },
				{ provide: DialogService, useValue: mockDialogService },
			],
		});

		TestBed.overrideComponent(PublishControlsWidget, {
			set: { template: '', imports: [] },
		});

		fixture = TestBed.createComponent(PublishControlsWidget);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('collection', 'posts');
		fixture.componentRef.setInput('documentId', 'abc123');
		if (initialStatus !== undefined) {
			fixture.componentRef.setInput('initialStatus', initialStatus);
		}
		fixture.detectChanges();
	}

	// ============================================
	// Creation
	// ============================================

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	// ============================================
	// Computed: statusVariant
	// ============================================

	describe('statusVariant', () => {
		it('should return "secondary" for draft', () => {
			setup('draft');
			expect(component.statusVariant()).toBe('secondary');
		});

		it('should return "default" for published', () => {
			setup('published');
			expect(component.statusVariant()).toBe('default');
		});
	});

	// ============================================
	// Computed: statusLabel
	// ============================================

	describe('statusLabel', () => {
		it('should return "Draft" for draft', () => {
			setup('draft');
			expect(component.statusLabel()).toBe('Draft');
		});

		it('should return "Published" for published', () => {
			setup('published');
			expect(component.statusLabel()).toBe('Published');
		});
	});

	// ============================================
	// Constructor effect: initialStatus
	// ============================================

	describe('initial status', () => {
		it('should use initial status when provided', () => {
			setup('published');
			expect(component.status()).toBe('published');
		});

		it('should load status from API when no initial status', async () => {
			mockVersionService = {
				getStatus: vi.fn().mockResolvedValue('published'),
				publish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
				unpublish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
				schedulePublish: vi
					.fn()
					.mockResolvedValue({ id: 'abc123', scheduledPublishAt: '2099-01-01T00:00:00.000Z' }),
				cancelScheduledPublish: vi.fn().mockResolvedValue({ message: 'ok' }),
				getScheduledPublishAt: vi.fn().mockResolvedValue(null),
			};
			mockFeedback = {
				confirmUnpublish: vi.fn().mockResolvedValue(true),
				confirmCancelSchedule: vi.fn().mockResolvedValue(true),
				publishScheduled: vi.fn(),
				scheduledPublishCancelled: vi.fn(),
				operationFailed: vi.fn(),
			};

			TestBed.configureTestingModule({
				imports: [PublishControlsWidget],
				providers: [
					{ provide: VersionService, useValue: mockVersionService },
					{ provide: FeedbackService, useValue: mockFeedback },
					{ provide: DialogService, useValue: { open: vi.fn() } },
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

			// Wait for the async loadStatus to resolve
			await vi.waitFor(() => {
				expect(mockVersionService['getStatus']).toHaveBeenCalledWith('posts', 'abc123');
			});

			await vi.waitFor(() => {
				expect(component.status()).toBe('published');
			});
		});

		it('should default to draft when API fails', async () => {
			mockVersionService = {
				getStatus: vi.fn().mockRejectedValue(new Error('Network error')),
				publish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
				unpublish: vi.fn().mockResolvedValue({ doc: {}, message: 'ok' }),
				schedulePublish: vi
					.fn()
					.mockResolvedValue({ id: 'abc123', scheduledPublishAt: '2099-01-01T00:00:00.000Z' }),
				cancelScheduledPublish: vi.fn().mockResolvedValue({ message: 'ok' }),
				getScheduledPublishAt: vi.fn().mockResolvedValue(null),
			};
			mockFeedback = {
				confirmUnpublish: vi.fn().mockResolvedValue(true),
				confirmCancelSchedule: vi.fn().mockResolvedValue(true),
				publishScheduled: vi.fn(),
				scheduledPublishCancelled: vi.fn(),
				operationFailed: vi.fn(),
			};

			TestBed.configureTestingModule({
				imports: [PublishControlsWidget],
				providers: [
					{ provide: VersionService, useValue: mockVersionService },
					{ provide: FeedbackService, useValue: mockFeedback },
					{ provide: DialogService, useValue: { open: vi.fn() } },
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
				expect(mockVersionService['getStatus']).toHaveBeenCalled();
			});

			await vi.waitFor(() => {
				expect(component.status()).toBe('draft');
			});

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});
		});
	});

	// ============================================
	// onPublish
	// ============================================

	describe('onPublish', () => {
		beforeEach(() => {
			setup('draft');
		});

		it('should call versionService.publish', async () => {
			await component.onPublish();
			expect(mockVersionService['publish']).toHaveBeenCalledWith('posts', 'abc123');
		});

		it('should update status to published', async () => {
			await component.onPublish();
			expect(component.status()).toBe('published');
		});

		it('should emit statusChanged', async () => {
			const emitSpy = vi.spyOn(component.statusChanged, 'emit');
			await component.onPublish();
			expect(emitSpy).toHaveBeenCalledWith('published');
		});

		it('should set isUpdating during operation', async () => {
			// Make publish hang so we can check isUpdating mid-flight
			let resolvePublish!: (value: unknown) => void;
			mockVersionService['publish'] = vi.fn(
				() => new Promise((resolve) => (resolvePublish = resolve)),
			);

			const publishPromise = component.onPublish();
			expect(component.isUpdating()).toBe(true);

			resolvePublish({ doc: {}, message: 'ok' });
			await publishPromise;

			expect(component.isUpdating()).toBe(false);
		});
	});

	// ============================================
	// onUnpublish
	// ============================================

	describe('onUnpublish', () => {
		beforeEach(() => {
			setup('published');
		});

		it('should call feedback.confirmUnpublish', async () => {
			await component.onUnpublish();
			expect(mockFeedback['confirmUnpublish']).toHaveBeenCalledWith('Document');
		});

		it('should not unpublish when not confirmed', async () => {
			mockFeedback['confirmUnpublish'] = vi.fn().mockResolvedValue(false);

			await component.onUnpublish();

			expect(mockVersionService['unpublish']).not.toHaveBeenCalled();
			expect(component.status()).toBe('published');
		});

		it('should call versionService.unpublish when confirmed', async () => {
			await component.onUnpublish();
			expect(mockVersionService['unpublish']).toHaveBeenCalledWith('posts', 'abc123');
		});

		it('should update status to draft', async () => {
			await component.onUnpublish();
			expect(component.status()).toBe('draft');
		});

		it('should emit statusChanged with draft', async () => {
			const emitSpy = vi.spyOn(component.statusChanged, 'emit');
			await component.onUnpublish();
			expect(emitSpy).toHaveBeenCalledWith('draft');
		});
	});
});
