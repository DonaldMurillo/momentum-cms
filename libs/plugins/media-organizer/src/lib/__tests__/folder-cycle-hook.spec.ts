import { describe, it, expect } from 'vitest';
import { preventFolderCycle } from '../media-folders.collection';
import type { HookArgs } from '@momentumcms/core';

function makeHookArgs(overrides: Partial<HookArgs> = {}): HookArgs {
	return {
		req: {},
		data: {},
		doc: {},
		...overrides,
	} as unknown as HookArgs;
}

describe('preventFolderCycle', () => {
	it('should allow creating a new folder (no doc id)', () => {
		const args = makeHookArgs({
			data: { parent: 'parent-1' },
			doc: undefined,
		});
		const result = preventFolderCycle(args);
		expect(result).toEqual({ parent: 'parent-1' });
	});

	it('should allow setting parent to null (root folder)', () => {
		const args = makeHookArgs({
			data: { parent: null },
			doc: { id: 'folder-1' },
		});
		const result = preventFolderCycle(args);
		expect(result).toEqual({ parent: null });
	});

	it('should reject setting parent to self', () => {
		const args = makeHookArgs({
			data: { parent: 'folder-1' },
			doc: { id: 'folder-1' },
		});
		expect(() => preventFolderCycle(args)).toThrow('A folder cannot be its own parent');
	});

	it('should allow valid parent changes', () => {
		const args = makeHookArgs({
			data: { parent: 'folder-b' },
			doc: { id: 'folder-a' },
		});
		const result = preventFolderCycle(args);
		expect(result).toEqual({ parent: 'folder-b' });
	});

	it('should pass through when no parent is being set', () => {
		const args = makeHookArgs({
			data: { name: 'renamed folder' },
			doc: { id: 'folder-a' },
		});
		const result = preventFolderCycle(args);
		expect(result).toEqual({ name: 'renamed folder' });
	});

	it('should pass through when data is undefined', () => {
		const args = makeHookArgs({
			data: undefined,
			doc: { id: 'folder-a' },
		});
		const result = preventFolderCycle(args);
		expect(result).toBeUndefined();
	});
});
