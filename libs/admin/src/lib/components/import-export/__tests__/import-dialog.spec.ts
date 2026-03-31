import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@momentumcms/ui';
import type { CollectionConfig } from '@momentumcms/core';
import { ImportDialog, type ImportDialogData } from '../import-dialog.component';
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

function createMockDialogRef(): { close: ReturnType<typeof vi.fn> } {
	return { close: vi.fn() };
}

/** Create a fake change event with the given file */
function createFileChangeEvent(file: File): Event {
	const fakeTarget = { files: [file], value: '' };
	return { target: fakeTarget } as unknown as Event;
}

describe('ImportDialog', () => {
	let fixture: ComponentFixture<ImportDialog>;
	let component: ImportDialog;
	let httpMock: HttpTestingController;
	let mockDialogRef: ReturnType<typeof createMockDialogRef>;
	let mockImportExport: {
		parseFile: ReturnType<typeof vi.fn>;
		dryRunImport: ReturnType<typeof vi.fn>;
		importDocuments: ReturnType<typeof vi.fn>;
	};
	let mockFeedback: {
		importSuccess: ReturnType<typeof vi.fn>;
		importPartialSuccess: ReturnType<typeof vi.fn>;
	};

	const dialogData: ImportDialogData = { collection: testCollection };

	beforeEach(async () => {
		mockDialogRef = createMockDialogRef();
		mockImportExport = {
			parseFile: vi.fn(),
			dryRunImport: vi.fn(),
			importDocuments: vi.fn(),
		};
		mockFeedback = {
			importSuccess: vi.fn(),
			importPartialSuccess: vi.fn(),
		};

		await TestBed.configureTestingModule({
			imports: [ImportDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: dialogData },
				{ provide: DialogRef, useValue: mockDialogRef },
				{ provide: ImportExportService, useValue: mockImportExport },
				{ provide: FeedbackService, useValue: mockFeedback },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ImportDialog);
		component = fixture.componentInstance;
		httpMock = TestBed.inject(HttpTestingController);
		fixture.detectChanges();
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('should create with upload step as initial state', () => {
		expect(component).toBeTruthy();
		expect(component.step()).toBe('upload');
		expect(component.file()).toBeNull();
	});

	it('should render the drop zone with aria-label', () => {
		const dropZone = fixture.nativeElement.querySelector('[data-testid="import-drop-zone"]');
		expect(dropZone).toBeTruthy();
		expect(dropZone.getAttribute('aria-label')).toBe('Drop file here or click to browse');
		expect(dropZone.getAttribute('role')).toBe('button');
		expect(dropZone.getAttribute('tabindex')).toBe('0');
	});

	it('should have file input that accepts only .json and .csv', () => {
		const fileInput = fixture.nativeElement.querySelector('[data-testid="import-file-input"]');
		expect(fileInput).toBeTruthy();
		expect(fileInput.getAttribute('accept')).toBe('.json,.csv');
	});

	it('should show file info after file selection', () => {
		const file = new File(['test'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));
		fixture.detectChanges();

		expect(component.file()).toBe(file);
		expect(fixture.nativeElement.textContent).toContain('data.json');
	});

	it('should reject non-json/csv files', () => {
		const file = new File(['test'], 'data.txt', { type: 'text/plain' });
		component.onFileSelected(createFileChangeEvent(file));
		fixture.detectChanges();

		expect(component.file()).toBeNull();
		expect(component.parseError()).toBe('Please select a .json or .csv file.');
	});

	it('should have validate button disabled when no file', () => {
		const btn = fixture.nativeElement.querySelector('[data-testid="validate-btn"]');
		expect(btn).toBeTruthy();
		expect(btn.disabled).toBe(true);
	});

	it('should enable validate button after file selection', () => {
		const file = new File(['[]'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));
		fixture.detectChanges();

		const btn = fixture.nativeElement.querySelector('[data-testid="validate-btn"]');
		expect(btn.disabled).toBe(false);
	});

	it('should transition to preview after successful validation', async () => {
		const file = new File(['[]'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));
		fixture.detectChanges();

		mockImportExport.parseFile.mockResolvedValue({ format: 'json', docs: [{ title: 'A' }] });
		mockImportExport.dryRunImport.mockResolvedValue({
			validation: [{ index: 0, valid: true, errors: [], coerced: {} }],
			total: 1,
		});

		await component.validate();
		fixture.detectChanges();

		expect(component.step()).toBe('preview');
		expect(component.dryRunResult()).toBeTruthy();
		expect(mockImportExport.dryRunImport).toHaveBeenCalledWith('products', 'json', {
			docs: [{ title: 'A' }],
		});
	});

	it('should show validation summary in preview step', async () => {
		const file = new File(['[]'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));

		mockImportExport.parseFile.mockResolvedValue({ format: 'json', docs: [{ title: 'A' }, {}] });
		mockImportExport.dryRunImport.mockResolvedValue({
			validation: [
				{ index: 0, valid: true, errors: [], coerced: {} },
				{ index: 1, valid: false, errors: [{ field: 'title', message: 'Required' }], coerced: {} },
			],
			total: 2,
		});

		await component.validate();
		fixture.detectChanges();

		const summary = fixture.nativeElement.querySelector('[data-testid="validation-summary"]');
		expect(summary).toBeTruthy();
		expect(summary.textContent).toContain('1 of 2 rows valid');
		expect(summary.textContent).toContain('1 with errors');
	});

	it('should disable import button when 0 valid rows', async () => {
		const file = new File(['[]'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));

		mockImportExport.parseFile.mockResolvedValue({ format: 'json', docs: [{}] });
		mockImportExport.dryRunImport.mockResolvedValue({
			validation: [
				{ index: 0, valid: false, errors: [{ field: 'title', message: 'Required' }], coerced: {} },
			],
			total: 1,
		});

		await component.validate();
		fixture.detectChanges();

		const importBtn = fixture.nativeElement.querySelector('[data-testid="import-btn"]');
		expect(importBtn).toBeTruthy();
		expect(importBtn.disabled).toBe(true);
	});

	it('should enable import button when valid rows exist', async () => {
		const file = new File(['[]'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));

		mockImportExport.parseFile.mockResolvedValue({ format: 'json', docs: [{ title: 'A' }] });
		mockImportExport.dryRunImport.mockResolvedValue({
			validation: [{ index: 0, valid: true, errors: [], coerced: {} }],
			total: 1,
		});

		await component.validate();
		fixture.detectChanges();

		const importBtn = fixture.nativeElement.querySelector('[data-testid="import-btn"]');
		expect(importBtn.disabled).toBe(false);
	});

	it('should execute import and show results', async () => {
		const file = new File(['[]'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));

		// Step 1: validate (dry run)
		mockImportExport.parseFile.mockResolvedValue({ format: 'json', docs: [{ title: 'A' }] });
		mockImportExport.dryRunImport.mockResolvedValue({
			validation: [{ index: 0, valid: true, errors: [], coerced: {} }],
			total: 1,
		});
		await component.validate();
		fixture.detectChanges();

		// Step 2: execute import
		mockImportExport.importDocuments.mockResolvedValue({
			imported: 1,
			total: 1,
			errors: [],
			docs: [{ id: '1', title: 'A' }],
		});
		await component.executeImport();
		fixture.detectChanges();

		expect(component.step()).toBe('results');
		const result = fixture.nativeElement.querySelector('[data-testid="import-result"]');
		expect(result).toBeTruthy();
		expect(result.textContent).toContain('1 documents imported successfully');
		expect(mockFeedback.importSuccess).toHaveBeenCalledWith('Products', 1);
	});

	it('should call importPartialSuccess feedback when some rows fail', async () => {
		const file = new File(['[]'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));

		mockImportExport.parseFile.mockResolvedValue({ format: 'json', docs: [{ title: 'A' }, {}] });
		mockImportExport.dryRunImport.mockResolvedValue({
			validation: [
				{ index: 0, valid: true, errors: [], coerced: {} },
				{ index: 1, valid: false, errors: [{ field: 'title', message: 'Required' }], coerced: {} },
			],
			total: 2,
		});
		await component.validate();

		mockImportExport.importDocuments.mockResolvedValue({
			imported: 1,
			total: 2,
			errors: [{ index: 1, message: 'Required field missing' }],
			docs: [{ id: '1', title: 'A' }],
		});
		await component.executeImport();
		fixture.detectChanges();

		expect(mockFeedback.importPartialSuccess).toHaveBeenCalledWith('Products', 1, 1);
	});

	it('should close dialog with result on done', () => {
		component.importResult.set({ imported: 3, total: 3, errors: [], docs: [] });
		component.step.set('results');
		fixture.detectChanges();

		component.done();

		expect(mockDialogRef.close).toHaveBeenCalledWith({ imported: 3 });
	});

	it('should close dialog with undefined on cancel', () => {
		component.close();
		expect(mockDialogRef.close).toHaveBeenCalledWith(undefined);
	});

	it('should go back to upload from preview', () => {
		component.step.set('preview');
		component.dryRunResult.set({ validation: [], total: 0 });
		fixture.detectChanges();

		component.backToUpload();
		expect(component.step()).toBe('upload');
		expect(component.dryRunResult()).toBeNull();
	});

	it('should format file sizes correctly', () => {
		expect(component.formatFileSize(500)).toBe('500 B');
		expect(component.formatFileSize(1024)).toBe('1.0 KB');
		expect(component.formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
	});

	it('should handle drag over events', () => {
		const event = { preventDefault: vi.fn() } as unknown as DragEvent;
		component.onDragOver(event);
		expect(component.isDragOver()).toBe(true);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	it('should handle drop events with file', () => {
		const file = new File(['[]'], 'data.json', { type: 'application/json' });
		const event = {
			preventDefault: vi.fn(),
			dataTransfer: { files: [file] },
		} as unknown as DragEvent;

		component.onDrop(event);
		expect(component.isDragOver()).toBe(false);
		expect(component.file()).toBe(file);
	});

	it('should show parse error on validation failure', async () => {
		const file = new File(['bad'], 'data.json', { type: 'application/json' });
		component.onFileSelected(createFileChangeEvent(file));
		fixture.detectChanges();

		mockImportExport.parseFile.mockRejectedValue(new Error('Invalid JSON file.'));

		await component.validate();
		fixture.detectChanges();

		expect(component.parseError()).toBe('Invalid JSON file.');
		expect(component.step()).toBe('upload');
	});
});
