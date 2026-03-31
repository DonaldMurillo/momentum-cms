import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import type { CollectionConfig } from '@momentumcms/core';
import { DialogService } from '@momentumcms/ui';
import { ImportExportMenu } from '../import-export-menu.component';
import { ImportExportService } from '../../../services/import-export.service';
import { FeedbackService } from '../../../widgets/feedback/feedback.service';

const testCollection: CollectionConfig = {
	slug: 'products',
	labels: { singular: 'Product', plural: 'Products' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'price', type: 'number', label: 'Price' },
	],
};

describe('ImportExportMenu', () => {
	let fixture: ComponentFixture<ImportExportMenu>;
	let component: ImportExportMenu;
	let mockImportExport: {
		exportCollection: ReturnType<typeof vi.fn>;
		exportSelected: ReturnType<typeof vi.fn>;
	};
	let mockDialogService: { open: ReturnType<typeof vi.fn> };
	let mockFeedback: {
		exportSuccess: ReturnType<typeof vi.fn>;
		importSuccess: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		mockImportExport = {
			exportCollection: vi.fn(),
			exportSelected: vi.fn(),
		};

		const afterClosed = new Subject<undefined>();
		mockDialogService = {
			open: vi.fn().mockReturnValue({ afterClosed }),
		};
		mockFeedback = {
			exportSuccess: vi.fn(),
			importSuccess: vi.fn(),
		};

		await TestBed.configureTestingModule({
			imports: [ImportExportMenu],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: ImportExportService, useValue: mockImportExport },
				{ provide: DialogService, useValue: mockDialogService },
				{ provide: FeedbackService, useValue: mockFeedback },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ImportExportMenu);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('collection', testCollection);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should render the dropdown trigger button', () => {
		const btn = fixture.nativeElement.querySelector('[data-testid="import-export-trigger"]');
		expect(btn).toBeTruthy();
		expect(btn.textContent).toContain('Import / Export');
	});

	it('should call exportCollection and show toast only after completion', () => {
		const exportSubject = new Subject<void>();
		mockImportExport.exportCollection = vi.fn().mockReturnValue(exportSubject.asObservable());

		component.exportJson();
		expect(mockImportExport.exportCollection).toHaveBeenCalledWith('products', 'json');

		// Toast should NOT fire before the observable completes
		expect(mockFeedback.exportSuccess).not.toHaveBeenCalled();

		// Emit completion
		exportSubject.next();
		exportSubject.complete();

		// Now the toast should fire
		expect(mockFeedback.exportSuccess).toHaveBeenCalledWith('Products', 'json');
	});

	it('should call exportCollection and show toast only after CSV completion', () => {
		const exportSubject = new Subject<void>();
		mockImportExport.exportCollection = vi.fn().mockReturnValue(exportSubject.asObservable());

		component.exportCsv();
		expect(mockImportExport.exportCollection).toHaveBeenCalledWith('products', 'csv');

		expect(mockFeedback.exportSuccess).not.toHaveBeenCalled();

		exportSubject.next();
		exportSubject.complete();

		expect(mockFeedback.exportSuccess).toHaveBeenCalledWith('Products', 'csv');
	});

	it('should emit importComplete when dialog closes with a result', () => {
		const afterClosedSubject = new Subject<{ imported: number } | undefined>();
		mockDialogService.open.mockReturnValue({ afterClosed: afterClosedSubject });

		const emitted: number[] = [];
		component.importComplete.subscribe((n: number) => emitted.push(n));

		component.openImport();
		afterClosedSubject.next({ imported: 5 });

		expect(emitted).toEqual([5]);
	});

	it('should not emit importComplete when dialog is cancelled', () => {
		const afterClosedSubject = new Subject<{ imported: number } | undefined>();
		mockDialogService.open.mockReturnValue({ afterClosed: afterClosedSubject });

		const emitted: number[] = [];
		component.importComplete.subscribe((n: number) => emitted.push(n));

		component.openImport();
		afterClosedSubject.next(undefined);

		expect(emitted).toEqual([]);
	});

	it('should open import dialog when openImport is called', () => {
		component.openImport();
		expect(mockDialogService.open).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				width: '36rem',
				data: { collection: testCollection },
			}),
		);
	});

	it('should compute collection label from labels.plural', () => {
		expect(component.collectionLabel()).toBe('Products');
	});

	it('should fallback to slug when labels.plural is not set', () => {
		const noLabelCollection: CollectionConfig = {
			slug: 'items',
			fields: [],
		};
		fixture.componentRef.setInput('collection', noLabelCollection);
		fixture.detectChanges();
		expect(component.collectionLabel()).toBe('items');
	});
});
