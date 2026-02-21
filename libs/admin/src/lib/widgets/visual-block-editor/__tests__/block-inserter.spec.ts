import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlockInserterComponent } from '../block-inserter.component';

const mockBlocks = [
	{
		slug: 'hero',
		labels: { singular: 'Hero' },
		fields: [],
	},
	{
		slug: 'text-block',
		labels: { singular: 'Text Block' },
		fields: [],
	},
	{
		slug: 'image-gallery',
		fields: [],
	},
];

describe('BlockInserterComponent', () => {
	let fixture: ComponentFixture<BlockInserterComponent>;
	let component: BlockInserterComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BlockInserterComponent],
		})
			.overrideComponent(BlockInserterComponent, {
				set: {
					imports: [],
					template: '<div></div>',
				},
			})
			.compileComponents();

		fixture = TestBed.createComponent(BlockInserterComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('insertIndex', 0);
		fixture.componentRef.setInput('blockDefinitions', mockBlocks);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should have required insertIndex input', () => {
		expect(component.insertIndex()).toBe(0);
	});

	it('should have required blockDefinitions input', () => {
		expect(component.blockDefinitions()).toEqual(mockBlocks);
	});

	it('should default disabled to false', () => {
		expect(component.disabled()).toBe(false);
	});

	it('should default searchQuery to empty string', () => {
		expect(component.searchQuery()).toBe('');
	});

	describe('filteredBlocks', () => {
		it('should return all blocks when search is empty', () => {
			expect(component.filteredBlocks()).toEqual(mockBlocks);
		});

		it('should filter blocks by label', () => {
			component.searchQuery.set('hero');
			expect(component.filteredBlocks()).toHaveLength(1);
			expect(component.filteredBlocks()[0].slug).toBe('hero');
		});

		it('should filter blocks by slug when no label', () => {
			component.searchQuery.set('image');
			expect(component.filteredBlocks()).toHaveLength(1);
			expect(component.filteredBlocks()[0].slug).toBe('image-gallery');
		});

		it('should be case insensitive', () => {
			component.searchQuery.set('TEXT');
			expect(component.filteredBlocks()).toHaveLength(1);
			expect(component.filteredBlocks()[0].slug).toBe('text-block');
		});

		it('should return empty array for no matches', () => {
			component.searchQuery.set('nonexistent');
			expect(component.filteredBlocks()).toHaveLength(0);
		});
	});

	describe('selectBlockType', () => {
		it('should emit blockTypeSelected with slug and insertIndex', () => {
			const emitted: { blockType: string; atIndex: number }[] = [];
			component.blockTypeSelected.subscribe((e) => emitted.push(e));

			component.selectBlockType('hero');

			expect(emitted).toHaveLength(1);
			expect(emitted[0]).toEqual({ blockType: 'hero', atIndex: 0 });
		});

		it('should reset searchQuery after selection', () => {
			component.searchQuery.set('test');
			component.selectBlockType('hero');
			expect(component.searchQuery()).toBe('');
		});
	});

	describe('popover callbacks', () => {
		it('should reset searchQuery on popover opened', () => {
			component.searchQuery.set('old');
			component.onPopoverOpened();
			expect(component.searchQuery()).toBe('');
		});

		it('should reset searchQuery on popover closed', () => {
			component.searchQuery.set('old');
			component.onPopoverClosed();
			expect(component.searchQuery()).toBe('');
		});
	});
});
