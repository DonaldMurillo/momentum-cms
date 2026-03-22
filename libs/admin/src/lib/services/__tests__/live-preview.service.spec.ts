import { LivePreviewService } from '../live-preview.service';

describe('LivePreviewService', () => {
	let service: LivePreviewService;

	beforeEach(() => {
		service = new LivePreviewService();
	});

	it('should create the service', () => {
		expect(service).toBeTruthy();
	});

	describe('entityId', () => {
		it('should default to undefined', () => {
			expect(service.entityId()).toBeUndefined();
		});

		it('should be settable', () => {
			service.entityId.set('abc-123');
			expect(service.entityId()).toBe('abc-123');
		});

		it('should be resettable to undefined', () => {
			service.entityId.set('abc-123');
			service.entityId.set(undefined);
			expect(service.entityId()).toBeUndefined();
		});
	});

	describe('collectionSlug', () => {
		it('should default to undefined', () => {
			expect(service.collectionSlug()).toBeUndefined();
		});

		it('should be settable', () => {
			service.collectionSlug.set('posts');
			expect(service.collectionSlug()).toBe('posts');
		});
	});

	describe('documentData', () => {
		it('should default to empty object', () => {
			expect(service.documentData()).toEqual({});
		});

		it('should be settable', () => {
			const data = { title: 'Hello', body: 'World' };
			service.documentData.set(data);
			expect(service.documentData()).toEqual(data);
		});

		it('should be resettable', () => {
			service.documentData.set({ title: 'Hello' });
			service.documentData.set({});
			expect(service.documentData()).toEqual({});
		});
	});
});
