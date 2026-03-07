import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlTree } from './tree.component';
import { HdlTreeItem } from './tree-item.component';

@Component({
	imports: [HdlTree, HdlTreeItem],
	template: `
		<hdl-tree #tree="hdlTree">
			<hdl-tree-item [parent]="tree.tree" value="item1">Item 1</hdl-tree-item>
			<hdl-tree-item [parent]="tree.tree" value="item2">Item 2</hdl-tree-item>
		</hdl-tree>
	`,
})
class TestHost {}

describe('HdlTree', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();
	});

	it('should render tree items', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-tree-item');
		expect(items.length).toBe(2);
	});

	it('should render item text content', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-tree-item');
		expect(items[0].textContent).toContain('Item 1');
		expect(items[1].textContent).toContain('Item 2');
	});

	it('should have role="tree" on the host', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const el = fixture.nativeElement.querySelector('hdl-tree');
		expect(el.getAttribute('role')).toBe('tree');
	});

	it('should have role="treeitem" on tree items', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const items = fixture.nativeElement.querySelectorAll('hdl-tree-item');
		expect(items[0].getAttribute('role')).toBe('treeitem');
	});

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-tree');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});
