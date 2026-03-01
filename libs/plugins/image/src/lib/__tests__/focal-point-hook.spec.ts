import { describe, it, expect, vi } from 'vitest';
import { createFocalPointHook } from '../hooks/focal-point-hook';

describe('createFocalPointHook (afterChange)', () => {
	it('should trigger reprocessing when focalPoint changes', async () => {
		const reprocess = vi.fn().mockResolvedValue(undefined);
		const hook = createFocalPointHook(reprocess);

		await hook({
			req: { user: { id: '1' } },
			doc: {
				id: 'media-1',
				focalPoint: { x: 0.6, y: 0.4 },
				path: 'abc.jpg',
				mimeType: 'image/jpeg',
			},
			originalDoc: { id: 'media-1', focalPoint: { x: 0.5, y: 0.5 }, path: 'abc.jpg' },
			operation: 'update',
		});

		expect(reprocess).toHaveBeenCalledOnce();
		expect(reprocess).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'media-1', focalPoint: { x: 0.6, y: 0.4 } }),
		);
	});

	it('should NOT reprocess when focalPoint is unchanged', async () => {
		const reprocess = vi.fn();
		const hook = createFocalPointHook(reprocess);

		await hook({
			req: { user: { id: '1' } },
			doc: { id: 'media-1', focalPoint: { x: 0.5, y: 0.5 } },
			originalDoc: { id: 'media-1', focalPoint: { x: 0.5, y: 0.5 } },
			operation: 'update',
		});

		expect(reprocess).not.toHaveBeenCalled();
	});

	it('should NOT reprocess on create operation', async () => {
		const reprocess = vi.fn();
		const hook = createFocalPointHook(reprocess);

		await hook({
			req: { user: { id: '1' } },
			doc: { id: 'media-1', focalPoint: { x: 0.5, y: 0.5 } },
			operation: 'create',
		});

		expect(reprocess).not.toHaveBeenCalled();
	});

	it('should NOT reprocess when there is no originalDoc', async () => {
		const reprocess = vi.fn();
		const hook = createFocalPointHook(reprocess);

		await hook({
			req: { user: { id: '1' } },
			doc: { id: 'media-1', focalPoint: { x: 0.3, y: 0.3 } },
			operation: 'update',
		});

		expect(reprocess).not.toHaveBeenCalled();
	});

	it('should NOT reprocess when doc has no path (non-image)', async () => {
		const reprocess = vi.fn();
		const hook = createFocalPointHook(reprocess);

		await hook({
			req: { user: { id: '1' } },
			doc: { id: 'doc-1', focalPoint: { x: 0.3, y: 0.3 } },
			originalDoc: { id: 'doc-1', focalPoint: { x: 0.5, y: 0.5 } },
			operation: 'update',
		});

		expect(reprocess).not.toHaveBeenCalled();
	});

	it('should reprocess when focalPoint is set for the first time', async () => {
		const reprocess = vi.fn().mockResolvedValue(undefined);
		const hook = createFocalPointHook(reprocess);

		await hook({
			req: { user: { id: '1' } },
			doc: {
				id: 'media-1',
				focalPoint: { x: 0.5, y: 0.5 },
				path: 'abc.jpg',
				mimeType: 'image/jpeg',
			},
			originalDoc: { id: 'media-1', path: 'abc.jpg' }, // no focalPoint before
			operation: 'update',
		});

		expect(reprocess).toHaveBeenCalledOnce();
	});
});
