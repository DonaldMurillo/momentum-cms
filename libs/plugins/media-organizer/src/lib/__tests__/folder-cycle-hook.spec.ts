import { describe, it, expect, vi } from 'vitest';
import { preventDuplicateSiblingFolderName, preventFolderCycle } from '../media-folders.collection';
import type { HookArgs } from '@momentumcms/core';

function makeHookArgs(overrides: Partial<HookArgs> = {}): HookArgs {
	return {
		req: {},
		data: {},
		originalDoc: {},
		...overrides,
	} as unknown as HookArgs;
}

describe('preventFolderCycle', () => {
	it('should allow creating a new folder (no doc id)', async () => {
		const args = makeHookArgs({
			data: { parent: 'parent-1' },
			originalDoc: undefined,
		});
		const result = await preventFolderCycle(args);
		expect(result).toEqual({ parent: 'parent-1' });
	});

	it('should allow setting parent to null (root folder)', async () => {
		const args = makeHookArgs({
			data: { parent: null },
			originalDoc: { id: 'folder-1' },
		});
		const result = await preventFolderCycle(args);
		expect(result).toEqual({ parent: null });
	});

	it('should reject setting parent to self', async () => {
		const args = makeHookArgs({
			data: { parent: 'folder-1' },
			originalDoc: { id: 'folder-1' },
		});
		await expect(preventFolderCycle(args)).rejects.toThrow('A folder cannot be its own parent');
	});

	it('should allow valid parent changes (no api available)', async () => {
		const args = makeHookArgs({
			data: { parent: 'folder-b' },
			originalDoc: { id: 'folder-a' },
		});
		const result = await preventFolderCycle(args);
		expect(result).toEqual({ parent: 'folder-b' });
	});

	it('should pass through when no parent is being set', async () => {
		const args = makeHookArgs({
			data: { name: 'renamed folder' },
			originalDoc: { id: 'folder-a' },
		});
		const result = await preventFolderCycle(args);
		expect(result).toEqual({ name: 'renamed folder' });
	});

	it('should pass through when data is undefined', async () => {
		const args = makeHookArgs({
			data: undefined,
			originalDoc: { id: 'folder-a' },
		});
		const result = await preventFolderCycle(args);
		expect(result).toBeUndefined();
	});

	it('should reject transitive cycle A→B→A', async () => {
		const args = makeHookArgs({
			data: { parent: 'folder-a' },
			originalDoc: { id: 'folder-b' },
			req: {
				api: {
					collection: () => ({
						find: vi.fn().mockResolvedValue({
							docs: [{ id: 'folder-a', parent: 'folder-b' }],
						}),
					}),
				},
			},
		});
		await expect(preventFolderCycle(args)).rejects.toThrow('would create a cycle');
	});

	it('should reject deep transitive cycle A→B→C→A', async () => {
		const findMock = vi
			.fn()
			.mockResolvedValueOnce({ docs: [{ id: 'folder-c', parent: 'folder-b' }] })
			.mockResolvedValueOnce({ docs: [{ id: 'folder-b', parent: 'folder-a' }] });
		const args = makeHookArgs({
			data: { parent: 'folder-c' },
			originalDoc: { id: 'folder-a' },
			req: {
				api: {
					collection: () => ({
						find: findMock,
					}),
				},
			},
		});
		await expect(preventFolderCycle(args)).rejects.toThrow('would create a cycle');
	});

	it('should allow valid deep parent assignment when no cycle exists', async () => {
		const findMock = vi
			.fn()
			.mockResolvedValueOnce({ docs: [{ id: 'folder-c', parent: 'folder-b' }] })
			.mockResolvedValueOnce({ docs: [{ id: 'folder-b', parent: null }] });
		const args = makeHookArgs({
			data: { parent: 'folder-c' },
			originalDoc: { id: 'folder-a' },
			req: {
				api: {
					collection: () => ({
						find: findMock,
					}),
				},
			},
		});
		const result = await preventFolderCycle(args);
		expect(result).toEqual({ parent: 'folder-c' });
	});

	it('should enforce depth limit and reject excessively deep chains', async () => {
		const findMock = vi.fn().mockResolvedValue({
			docs: [{ id: 'some-id', parent: 'another-id' }],
		});
		const args = makeHookArgs({
			data: { parent: 'folder-deep' },
			originalDoc: { id: 'folder-a' },
			req: {
				api: {
					collection: () => ({
						find: findMock,
					}),
				},
			},
		});
		await expect(preventFolderCycle(args)).rejects.toThrow();
		// Should cap at a reasonable depth, not make unlimited queries
		expect(findMock.mock.calls.length).toBeLessThanOrEqual(50);
	});

	it('reports accurate error when ancestor chain exceeds maximum depth', async () => {
		// Mock a chain of folders that never terminates (simulates depth > MAX_ANCESTOR_DEPTH)
		const findMock = vi.fn().mockResolvedValue({
			docs: [{ id: 'deep-id', parent: 'even-deeper-id' }],
		});
		const args = makeHookArgs({
			data: { parent: 'deep-folder-id' },
			originalDoc: { id: 'folder-id' },
			req: {
				api: {
					collection: () => ({
						find: findMock,
					}),
				},
			},
		});

		await expect(preventFolderCycle(args)).rejects.toThrow(/too deep or contains a cycle/i);
	});
});

describe('preventDuplicateSiblingFolderName', () => {
	it('should assign the root parentKey for root folders', async () => {
		const result = await preventDuplicateSiblingFolderName(
			makeHookArgs({
				data: { name: 'Root Folder' },
				req: {
					api: {
						collection: () => ({
							find: async () => ({ docs: [] }),
						}),
					},
				},
			}),
		);

		expect(result).toEqual({
			name: 'Root Folder',
			parentKey: '__root__',
		});
	});

	it('should assign parentKey for nested folders', async () => {
		const result = await preventDuplicateSiblingFolderName(
			makeHookArgs({
				data: { name: 'Child Folder', parent: 'parent-1' },
				req: {
					api: {
						collection: () => ({
							find: async () => ({ docs: [] }),
						}),
					},
				},
			}),
		);

		expect(result).toEqual({
			name: 'Child Folder',
			parent: 'parent-1',
			parentKey: 'parent-1',
		});
	});

	it('should reject duplicate root folder names', async () => {
		await expect(
			preventDuplicateSiblingFolderName(
				makeHookArgs({
					data: { name: 'Duplicate Root' },
					req: {
						api: {
							collection: () => ({
								find: async () => ({
									docs: [{ id: 'folder-1', parent: null }],
								}),
							}),
						},
					},
				}),
			),
		).rejects.toThrow('A folder with this name already exists in the selected parent');
	});

	it('should ignore the current document during updates', async () => {
		const result = await preventDuplicateSiblingFolderName(
			makeHookArgs({
				data: { name: 'Renamed Root' },
				originalDoc: { id: 'folder-1', parent: null },
				req: {
					api: {
						collection: () => ({
							find: async () => ({
								docs: [{ id: 'folder-1', parent: null }],
							}),
						}),
					},
				},
			}),
		);

		expect(result).toEqual({
			name: 'Renamed Root',
			parentKey: '__root__',
		});
	});
});
