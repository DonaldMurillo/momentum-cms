import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tree } from './tree.component';
import { TreeItem } from './tree-item.component';
import { TreeItemGroupComponent } from './tree-item-group.component';

describe('Tree', () => {
	let fixture: ComponentFixture<Tree>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Tree],
		}).compileComponents();

		fixture = TestBed.createComponent(Tree);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="tree"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('tree');
	});

	it('should have block display', () => {
		expect(fixture.nativeElement.classList.contains('block')).toBe(true);
	});

	it('should not be multiselectable by default', () => {
		expect(fixture.nativeElement.getAttribute('aria-multiselectable')).toBe('false');
	});

	it('should support multi-select', () => {
		fixture.componentRef.setInput('multi', true);
		fixture.detectChanges();
		expect(fixture.nativeElement.getAttribute('aria-multiselectable')).toBe('true');
	});

	it('should have text-sm class', () => {
		expect(fixture.nativeElement.classList.contains('text-sm')).toBe(true);
	});

	it('should apply custom class', () => {
		fixture.componentRef.setInput('class', 'custom-class');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('custom-class')).toBe(true);
	});

	it('should support disabled state', () => {
		expect(fixture.componentInstance.disabled()).toBe(false);
		fixture.componentRef.setInput('disabled', true);
		fixture.detectChanges();
		expect(fixture.componentInstance.disabled()).toBe(true);
	});

	it('should default to explicit selection mode', () => {
		expect(fixture.componentInstance.selectionMode()).toBe('explicit');
	});

	it('should default to wrap navigation', () => {
		expect(fixture.componentInstance.wrap()).toBe(true);
	});
});

describe('TreeItem', () => {
	// Note: TreeItem cannot be tested in isolation because it requires a parent
	// tree or tree item group. It also uses @angular/aria/tree's TreeItem
	// directive which has required parent context dependencies.
	// The component should be tested via integration tests with a full tree structure.

	it('should export the component', () => {
		expect(TreeItem).toBeDefined();
	});
});

describe('TreeItemGroupComponent', () => {
	// Note: TreeItemGroupComponent cannot be tested in isolation because
	// @angular/aria/tree's TreeItemGroup directive requires TemplateRef context.
	// The component should be tested via integration tests with a full tree structure.

	it('should export the component', () => {
		expect(TreeItemGroupComponent).toBeDefined();
	});
});
