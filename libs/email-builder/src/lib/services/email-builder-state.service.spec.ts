import { TestBed } from '@angular/core/testing';
import { EmailBuilderStateService, generateBlockId } from './email-builder-state.service';
import type { EmailBlock, EmailTheme } from '@momentumcms/email';

function makeBlock(overrides: Partial<EmailBlock> = {}): EmailBlock {
	return {
		type: 'text',
		id: generateBlockId(),
		data: { content: 'Hello' },
		...overrides,
	};
}

describe('EmailBuilderStateService', () => {
	let service: EmailBuilderStateService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [EmailBuilderStateService],
		});
		service = TestBed.inject(EmailBuilderStateService);
	});

	it('should start with empty state', () => {
		expect(service.blocks()).toEqual([]);
		expect(service.blockCount()).toBe(0);
		expect(service.selectedBlockId()).toBeNull();
		expect(service.hoveredBlockId()).toBeNull();
		expect(service.inserterOpen()).toBeNull();
		expect(service.theme()).toBeUndefined();
	});

	describe('setBlocks', () => {
		it('should set blocks', () => {
			const blocks = [makeBlock({ id: 'a' }), makeBlock({ id: 'b' })];
			service.setBlocks(blocks);
			expect(service.blocks()).toEqual(blocks);
			expect(service.blockCount()).toBe(2);
		});
	});

	describe('setTheme', () => {
		it('should set theme', () => {
			const theme: EmailTheme = {
				primaryColor: '#000',
				backgroundColor: '#fff',
				textColor: '#333',
				mutedColor: '#999',
				fontFamily: 'Arial',
				borderRadius: '4px',
			};
			service.setTheme(theme);
			expect(service.theme()).toEqual(theme);
		});
	});

	describe('addBlock', () => {
		it('should add a block at the specified index', () => {
			const a = makeBlock({ id: 'a' });
			const b = makeBlock({ id: 'b' });
			const c = makeBlock({ id: 'c' });

			service.setBlocks([a, c]);
			service.addBlock(b, 1);

			expect(service.blocks().map((b) => b.id)).toEqual(['a', 'b', 'c']);
		});

		it('should select the added block', () => {
			const block = makeBlock({ id: 'new' });
			service.addBlock(block, 0);
			expect(service.selectedBlockId()).toBe('new');
		});

		it('should close the inserter', () => {
			service.inserterOpen.set({ index: 0 });
			service.addBlock(makeBlock(), 0);
			expect(service.inserterOpen()).toBeNull();
		});
	});

	describe('removeBlock', () => {
		it('should remove a block by id', () => {
			service.setBlocks([makeBlock({ id: 'a' }), makeBlock({ id: 'b' })]);
			service.removeBlock('a');
			expect(service.blocks().map((b) => b.id)).toEqual(['b']);
		});

		it('should clear selection if removed block was selected', () => {
			service.setBlocks([makeBlock({ id: 'a' })]);
			service.selectedBlockId.set('a');
			service.removeBlock('a');
			expect(service.selectedBlockId()).toBeNull();
		});

		it('should keep selection if a different block was removed', () => {
			service.setBlocks([makeBlock({ id: 'a' }), makeBlock({ id: 'b' })]);
			service.selectedBlockId.set('a');
			service.removeBlock('b');
			expect(service.selectedBlockId()).toBe('a');
		});
	});

	describe('moveBlock', () => {
		it('should move a block from one index to another', () => {
			service.setBlocks([makeBlock({ id: 'a' }), makeBlock({ id: 'b' }), makeBlock({ id: 'c' })]);
			service.moveBlock(0, 2);
			expect(service.blocks().map((b) => b.id)).toEqual(['b', 'c', 'a']);
		});

		it('should ignore out-of-bounds indices', () => {
			service.setBlocks([makeBlock({ id: 'a' }), makeBlock({ id: 'b' })]);
			service.moveBlock(-1, 0);
			expect(service.blocks().map((b) => b.id)).toEqual(['a', 'b']);
		});
	});

	describe('updateBlockData', () => {
		it('should merge data into the target block', () => {
			service.setBlocks([makeBlock({ id: 'a', data: { content: 'old', fontSize: 16 } })]);
			service.updateBlockData('a', { content: 'new' });
			expect(service.blocks()[0].data).toEqual({ content: 'new', fontSize: 16 });
		});

		it('should not affect other blocks', () => {
			service.setBlocks([
				makeBlock({ id: 'a', data: { content: 'A' } }),
				makeBlock({ id: 'b', data: { content: 'B' } }),
			]);
			service.updateBlockData('a', { content: 'updated' });
			expect(service.blocks()[1].data).toEqual({ content: 'B' });
		});
	});

	describe('duplicateBlock', () => {
		it('should insert a copy after the original', () => {
			service.setBlocks([makeBlock({ id: 'a', type: 'text', data: { content: 'Hello' } })]);
			service.duplicateBlock('a');
			expect(service.blockCount()).toBe(2);
			expect(service.blocks()[1].type).toBe('text');
			expect(service.blocks()[1].data).toEqual({ content: 'Hello' });
			expect(service.blocks()[1].id).not.toBe('a');
		});

		it('should select the duplicate', () => {
			service.setBlocks([makeBlock({ id: 'a' })]);
			service.duplicateBlock('a');
			expect(service.selectedBlockId()).toBe(service.blocks()[1].id);
		});
	});

	describe('selectedBlock computed', () => {
		it('should return null when nothing is selected', () => {
			expect(service.selectedBlock()).toBeNull();
		});

		it('should return the selected block', () => {
			const block = makeBlock({ id: 'a' });
			service.setBlocks([block]);
			service.selectedBlockId.set('a');
			expect(service.selectedBlock()).toEqual(block);
		});
	});

	describe('selectedBlockIndex computed', () => {
		it('should return -1 when nothing is selected', () => {
			expect(service.selectedBlockIndex()).toBe(-1);
		});

		it('should return the index of the selected block', () => {
			service.setBlocks([makeBlock({ id: 'a' }), makeBlock({ id: 'b' })]);
			service.selectedBlockId.set('b');
			expect(service.selectedBlockIndex()).toBe(1);
		});
	});

	describe('clearSelection', () => {
		it('should clear all UI state', () => {
			service.selectedBlockId.set('a');
			service.hoveredBlockId.set('b');
			service.inserterOpen.set({ index: 1 });
			service.clearSelection();
			expect(service.selectedBlockId()).toBeNull();
			expect(service.hoveredBlockId()).toBeNull();
			expect(service.inserterOpen()).toBeNull();
		});
	});

	describe('reset', () => {
		it('should reset all state', () => {
			service.setBlocks([makeBlock()]);
			service.setTheme({
				primaryColor: '#000',
				backgroundColor: '#fff',
				textColor: '#333',
				mutedColor: '#999',
				fontFamily: 'Arial',
				borderRadius: '4px',
			});
			service.selectedBlockId.set('a');
			service.reset();
			expect(service.blocks()).toEqual([]);
			expect(service.theme()).toBeUndefined();
			expect(service.selectedBlockId()).toBeNull();
		});
	});
});

describe('generateBlockId', () => {
	it('should generate unique ids', () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateBlockId()));
		expect(ids.size).toBe(100);
	});

	it('should generate short alphanumeric strings', () => {
		const id = generateBlockId();
		expect(id).toMatch(/^[a-z0-9]+$/);
		expect(id.length).toBeGreaterThanOrEqual(4);
	});
});
