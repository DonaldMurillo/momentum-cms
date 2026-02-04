import { TestBed } from '@angular/core/testing';
import { ToastService, ConfirmationService } from '@momentum-cms/ui';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
	let service: FeedbackService;
	let mockToast: {
		success: ReturnType<typeof vi.fn>;
		error: ReturnType<typeof vi.fn>;
		warning: ReturnType<typeof vi.fn>;
	};
	let mockConfirmation: {
		confirm: ReturnType<typeof vi.fn>;
		discardChanges: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockToast = {
			success: vi.fn(),
			error: vi.fn(),
			warning: vi.fn(),
		};

		mockConfirmation = {
			confirm: vi.fn().mockResolvedValue(true),
			discardChanges: vi.fn().mockResolvedValue(true),
		};

		TestBed.configureTestingModule({
			providers: [
				FeedbackService,
				{ provide: ToastService, useValue: mockToast },
				{ provide: ConfirmationService, useValue: mockConfirmation },
			],
		});

		service = TestBed.inject(FeedbackService);
	});

	describe('Success Messages', () => {
		it('should show entity created message', () => {
			service.entityCreated('Post');

			expect(mockToast.success).toHaveBeenCalledWith(
				'Post created',
				'The post has been created successfully.',
			);
		});

		it('should show entity updated message', () => {
			service.entityUpdated('Post');

			expect(mockToast.success).toHaveBeenCalledWith(
				'Post updated',
				'The post has been updated successfully.',
			);
		});

		it('should show entity deleted message', () => {
			service.entityDeleted('Post');

			expect(mockToast.success).toHaveBeenCalledWith('Post deleted', 'The post has been deleted.');
		});

		it('should show bulk delete message', () => {
			service.entitiesDeleted('Posts', 5);

			expect(mockToast.success).toHaveBeenCalledWith(
				'5 posts deleted',
				'5 items have been deleted successfully.',
			);
		});

		it('should show published message', () => {
			service.entityPublished('Article');

			expect(mockToast.success).toHaveBeenCalledWith(
				'Article published',
				'The article is now live.',
			);
		});

		it('should show unpublished message', () => {
			service.entityUnpublished('Article');

			expect(mockToast.success).toHaveBeenCalledWith(
				'Article unpublished',
				'The article has been unpublished.',
			);
		});
	});

	describe('Error Messages', () => {
		it('should show operation failed message', () => {
			service.operationFailed('Failed to save');

			expect(mockToast.error).toHaveBeenCalledWith(
				'Failed to save',
				'Please try again or contact support.',
			);
		});

		it('should show operation failed with error message', () => {
			const error = new Error('Network error');
			service.operationFailed('Failed to save', error);

			expect(mockToast.error).toHaveBeenCalledWith('Failed to save', 'Network error');
		});

		it('should show validation failed message for single field', () => {
			service.validationFailed(1);

			expect(mockToast.error).toHaveBeenCalledWith(
				'Validation failed',
				'Please fix 1 field with errors.',
			);
		});

		it('should show validation failed message for multiple fields', () => {
			service.validationFailed(3);

			expect(mockToast.error).toHaveBeenCalledWith(
				'Validation failed',
				'Please fix 3 fields with errors.',
			);
		});

		it('should show not authorized message', () => {
			service.notAuthorized('delete this post');

			expect(mockToast.error).toHaveBeenCalledWith(
				'Not authorized',
				"You don't have permission to delete this post.",
			);
		});

		it('should show entity not found message', () => {
			service.entityNotFound('Post');

			expect(mockToast.error).toHaveBeenCalledWith(
				'Post not found',
				'The requested post could not be found.',
			);
		});
	});

	describe('Warning Messages', () => {
		it('should show unsaved changes warning', () => {
			service.unsavedChanges();

			expect(mockToast.warning).toHaveBeenCalledWith(
				'Unsaved changes',
				'You have unsaved changes that will be lost.',
			);
		});
	});

	describe('Confirmations', () => {
		it('should confirm delete with entity title', async () => {
			await service.confirmDelete('Post', 'My Blog Post');

			expect(mockConfirmation.confirm).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Delete "My Blog Post"?',
					variant: 'destructive',
				}),
			);
		});

		it('should confirm delete without entity title', async () => {
			await service.confirmDelete('Post');

			expect(mockConfirmation.confirm).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Delete this post?',
					variant: 'destructive',
				}),
			);
		});

		it('should confirm bulk delete', async () => {
			await service.confirmBulkDelete('Posts', 5);

			expect(mockConfirmation.confirm).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Delete 5 posts?',
					confirmText: 'Delete 5 items',
					variant: 'destructive',
				}),
			);
		});

		it('should confirm discard', async () => {
			await service.confirmDiscard();

			expect(mockConfirmation.discardChanges).toHaveBeenCalled();
		});

		it('should confirm unpublish', async () => {
			await service.confirmUnpublish('Article');

			expect(mockConfirmation.confirm).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Unpublish this article?',
				}),
			);
		});

		it('should return confirmation result', async () => {
			mockConfirmation.confirm.mockResolvedValue(false);

			const result = await service.confirmDelete('Post');

			expect(result).toBe(false);
		});

		it('should allow custom confirmation', async () => {
			await service.confirm({
				title: 'Custom title',
				description: 'Custom description',
				confirmText: 'Yes',
				variant: 'default',
			});

			expect(mockConfirmation.confirm).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Custom title',
					description: 'Custom description',
					confirmText: 'Yes',
					icon: 'question',
				}),
			);
		});

		it('should use danger icon for destructive custom confirmation', async () => {
			await service.confirm({
				title: 'Delete everything?',
				description: 'This is dangerous',
				variant: 'destructive',
			});

			expect(mockConfirmation.confirm).toHaveBeenCalledWith(
				expect.objectContaining({
					icon: 'danger',
				}),
			);
		});
	});
});
