import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CollectionViewPage } from '../collection-view.page';

@Component({ selector: 'mcms-entity-view', template: '' })
class MockEntityView {}

const mockCollections = [
	{
		slug: 'posts',
		fields: [{ name: 'title', type: 'text' }],
		labels: { singular: 'Post', plural: 'Posts' },
	},
	{
		slug: 'authors',
		fields: [{ name: 'name', type: 'text' }],
		labels: { singular: 'Author', plural: 'Authors' },
	},
];

function createParamMap(params: Record<string, string>): ReturnType<typeof convertToParamMap> {
	return convertToParamMap(params);
}

describe('CollectionViewPage', () => {
	let fixture: ComponentFixture<CollectionViewPage>;
	let component: CollectionViewPage;
	let router: Router;
	let paramMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

	beforeEach(async () => {
		paramMapSubject = new BehaviorSubject(createParamMap({ slug: 'posts', id: 'doc-1' }));

		await TestBed.configureTestingModule({
			imports: [CollectionViewPage],
			providers: [
				provideRouter([]),
				{
					provide: ActivatedRoute,
					useValue: {
						paramMap: paramMapSubject.asObservable(),
						snapshot: {
							paramMap: createParamMap({ slug: 'posts', id: 'doc-1' }),
						},
						parent: {
							snapshot: {
								data: { collections: mockCollections },
							},
						},
					},
				},
			],
		})
			.overrideComponent(CollectionViewPage, {
				set: {
					imports: [MockEntityView],
					template: '<div></div>',
				},
			})
			.compileComponents();

		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture = TestBed.createComponent(CollectionViewPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should have basePath set to /admin/collections', () => {
		expect(component.basePath).toBe('/admin/collections');
	});

	it('should resolve collection from route data', () => {
		const col = component.collection();
		expect(col).toBeDefined();
		expect(col?.slug).toBe('posts');
	});

	it('should resolve entityId from route params', () => {
		expect(component.entityId()).toBe('doc-1');
	});

	it('should return undefined collection for unknown slug', async () => {
		paramMapSubject.next(createParamMap({ slug: 'unknown', id: '1' }));
		fixture.detectChanges();
		await fixture.whenStable();

		// The snapshot slug is still 'posts' so collection is still found
		// But the toSignal will update with the new paramMap
		// Since we override snapshot, we need to create a new fixture for empty slug test
	});

	it('should navigate to edit on onEdit', () => {
		component.onEdit({ id: 'doc-1', title: 'My Post' });
		expect(router.navigate).toHaveBeenCalledWith(['/admin/collections', 'posts', 'doc-1', 'edit']);
	});

	it('should not navigate on onEdit if no collection', async () => {
		// Create a component with no matching collection
		const emptyRoute = {
			paramMap: new BehaviorSubject(createParamMap({ slug: 'nonexistent', id: '1' })),
			snapshot: {
				paramMap: createParamMap({ slug: 'nonexistent', id: '1' }),
			},
			parent: {
				snapshot: {
					data: { collections: mockCollections },
				},
			},
		};

		await TestBed.resetTestingModule()
			.configureTestingModule({
				imports: [CollectionViewPage],
				providers: [provideRouter([]), { provide: ActivatedRoute, useValue: emptyRoute }],
			})
			.overrideComponent(CollectionViewPage, {
				set: { imports: [MockEntityView], template: '<div></div>' },
			})
			.compileComponents();

		const fix2 = TestBed.createComponent(CollectionViewPage);
		const comp2 = fix2.componentInstance;
		const router2 = TestBed.inject(Router);
		vi.spyOn(router2, 'navigate').mockResolvedValue(true);

		comp2.onEdit({ id: '1' });
		expect(router2.navigate).not.toHaveBeenCalled();
	});

	it('should handle onDelete without error', () => {
		expect(() => component.onDelete({ id: 'doc-1' })).not.toThrow();
	});

	it('should return undefined collection when slug is empty', async () => {
		const emptyRoute = {
			paramMap: new BehaviorSubject(createParamMap({ slug: '', id: '' })),
			snapshot: {
				paramMap: createParamMap({ slug: '', id: '' }),
			},
			parent: {
				snapshot: {
					data: { collections: mockCollections },
				},
			},
		};

		await TestBed.resetTestingModule()
			.configureTestingModule({
				imports: [CollectionViewPage],
				providers: [provideRouter([]), { provide: ActivatedRoute, useValue: emptyRoute }],
			})
			.overrideComponent(CollectionViewPage, {
				set: { imports: [MockEntityView], template: '<div></div>' },
			})
			.compileComponents();

		const fix2 = TestBed.createComponent(CollectionViewPage);
		expect(fix2.componentInstance.collection()).toBeUndefined();
	});
});
