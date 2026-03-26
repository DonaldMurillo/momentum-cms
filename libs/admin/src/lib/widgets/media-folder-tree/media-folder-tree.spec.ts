import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import {
	MediaFolderTreeComponent,
	buildFolderTree,
	getDescendantIds,
	type FolderNode,
} from './media-folder-tree.component';

const FOLDERS: FolderNode[] = [
	{ id: '1', name: 'Photos', parent: null },
	{ id: '2', name: 'Documents', parent: null },
	{ id: '3', name: 'Vacations', parent: '1' },
	{ id: '4', name: 'Work', parent: '1' },
	{ id: '5', name: 'Beach', parent: '3' },
];

@Component({
	selector: 'mcms-test-host',
	imports: [MediaFolderTreeComponent],
	template: `
		<mcms-media-folder-tree
			[folders]="folders()"
			[selectedFolderId]="selectedId()"
			(folderSelected)="onSelect($event)"
			(createFolderClicked)="createCount.set(createCount() + 1)"
		/>
	`,
})
class TestHost {
	readonly folders = signal<FolderNode[]>(FOLDERS);
	readonly selectedId = signal<string | null>(null);
	readonly emittedId = signal<string | null | undefined>(undefined);
	readonly createCount = signal(0);

	onSelect(id: string | null): void {
		this.emittedId.set(id);
		this.selectedId.set(id);
	}
}

describe('MediaFolderTreeComponent', () => {
	let fixture: ComponentFixture<TestHost>;
	let host: TestHost;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHost);
		host = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should render "All Media" root option', () => {
		const allMedia = fixture.nativeElement.querySelector('[data-slot="all-media"]');
		expect(allMedia).toBeTruthy();
		expect(allMedia.textContent).toContain('All Media');
	});

	it('should render root folders', () => {
		const buttons = fixture.nativeElement.querySelectorAll('[role="treeitem"]');
		// "All Media" + 2 root folders (Photos, Documents) — children hidden until expanded
		expect(buttons.length).toBe(3);
	});

	it('should emit null when "All Media" is clicked', () => {
		const allMedia = fixture.nativeElement.querySelector('[data-slot="all-media"]');
		allMedia.click();
		fixture.detectChanges();
		expect(host.emittedId()).toBeNull();
	});

	it('should emit folder ID when a folder is clicked', () => {
		const folderButtons = fixture.nativeElement.querySelectorAll('[data-folder-id]');
		folderButtons[0].click();
		fixture.detectChanges();
		expect(host.emittedId()).toBe('1');
	});

	it('should highlight selected folder', () => {
		host.selectedId.set('1');
		fixture.detectChanges();
		const selected = fixture.nativeElement.querySelector('[data-folder-id="1"]');
		expect(selected.classList.contains('font-medium')).toBe(true);
	});

	it('should expand folder to show children', () => {
		// Photos has children, click its expand toggle
		const component = fixture.debugElement.children[0]
			.componentInstance as MediaFolderTreeComponent;
		component.toggleExpand('1');
		fixture.detectChanges();

		const folderButtons = fixture.nativeElement.querySelectorAll(
			'[data-folder-id]',
		) as NodeListOf<HTMLElement>;
		const names = Array.from(folderButtons).map((b) => b.textContent?.trim());
		// Should now show Photos, Vacations, Work, Documents
		expect(names).toContain('Vacations');
		expect(names).toContain('Work');
	});

	it('should collapse expanded folder', () => {
		const component = fixture.debugElement.children[0]
			.componentInstance as MediaFolderTreeComponent;
		component.toggleExpand('1');
		fixture.detectChanges();

		let buttons = fixture.nativeElement.querySelectorAll('[data-folder-id]');
		const expandedCount = buttons.length;

		component.toggleExpand('1');
		fixture.detectChanges();

		buttons = fixture.nativeElement.querySelectorAll('[data-folder-id]');
		expect(buttons.length).toBeLessThan(expandedCount);
	});

	it('should show deeply nested children when expanded', () => {
		const component = fixture.debugElement.children[0]
			.componentInstance as MediaFolderTreeComponent;
		component.toggleExpand('1');
		component.toggleExpand('3');
		fixture.detectChanges();

		const folderButtons = fixture.nativeElement.querySelectorAll(
			'[data-folder-id]',
		) as NodeListOf<HTMLElement>;
		const names = Array.from(folderButtons).map((b) => b.textContent?.trim());
		expect(names).toContain('Beach');
	});

	it('should emit createFolderClicked when "New Folder" is clicked', () => {
		const btn = fixture.nativeElement.querySelector('[data-slot="create-folder"]');
		btn.click();
		fixture.detectChanges();
		expect(host.createCount()).toBe(1);
	});

	it('should have role="tree" on container', () => {
		const tree = fixture.nativeElement.querySelector('[role="tree"]');
		expect(tree).toBeTruthy();
	});
});

describe('buildFolderTree', () => {
	it('should build tree from flat list', () => {
		const tree = buildFolderTree(FOLDERS);
		expect(tree.length).toBe(2); // Photos, Documents
		const photos = tree.find((n) => n.name === 'Photos');
		expect(photos?.children.length).toBe(2);
	});

	it('should compute display paths', () => {
		const tree = buildFolderTree(FOLDERS);
		const photos = tree.find((n) => n.name === 'Photos');
		expect(photos?.path).toBe('/Photos');
		const vacations = photos?.children.find((n) => n.name === 'Vacations');
		expect(vacations?.path).toBe('/Photos/Vacations');
		const beach = vacations?.children.find((n) => n.name === 'Beach');
		expect(beach?.path).toBe('/Photos/Vacations/Beach');
	});

	it('should handle empty list', () => {
		expect(buildFolderTree([]).length).toBe(0);
	});

	it('should handle orphaned nodes (parent not in list)', () => {
		const folders: FolderNode[] = [{ id: '1', name: 'A', parent: 'missing' }];
		const tree = buildFolderTree(folders);
		expect(tree.length).toBe(1);
		expect(tree[0].name).toBe('A');
	});
});

describe('getDescendantIds', () => {
	it('should return all descendant IDs', () => {
		const tree = buildFolderTree(FOLDERS);
		const ids = getDescendantIds(tree, '1'); // Photos → Vacations, Work, Beach
		expect(ids.has('3')).toBe(true);
		expect(ids.has('4')).toBe(true);
		expect(ids.has('5')).toBe(true);
		expect(ids.has('1')).toBe(false); // Not self
		expect(ids.has('2')).toBe(false); // Not sibling
	});

	it('should return empty set for leaf node', () => {
		const tree = buildFolderTree(FOLDERS);
		const ids = getDescendantIds(tree, '5');
		expect(ids.size).toBe(0);
	});
});
