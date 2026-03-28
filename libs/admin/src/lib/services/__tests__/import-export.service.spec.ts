import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImportExportService } from '../import-export.service';

describe('ImportExportService', () => {
	let service: ImportExportService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(ImportExportService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	// ============================================
	// exportCollection
	// ============================================

	describe('exportCollection', () => {
		it('should call GET /api/:slug/export?format=json for JSON export', () => {
			service.exportCollection('posts', 'json');

			const req = httpMock.expectOne('/api/posts/export?format=json');
			expect(req.request.method).toBe('GET');
			req.flush({ collection: 'posts', format: 'json', totalDocs: 0, docs: [] });
		});

		it('should call GET /api/:slug/export?format=csv for CSV export', () => {
			service.exportCollection('posts', 'csv');

			const req = httpMock.expectOne('/api/posts/export?format=csv');
			expect(req.request.method).toBe('GET');
			req.flush('title,price\nWidget,9.99');
		});
	});

	// ============================================
	// exportSelected
	// ============================================

	describe('exportSelected', () => {
		it('should create a JSON download with the selected entities', () => {
			const clickSpy = vi.fn();
			let capturedHref = '';
			let capturedDownload = '';
			const fakeAnchor = {
				get href() {
					return capturedHref;
				},
				set href(v: string) {
					capturedHref = v;
				},
				get download() {
					return capturedDownload;
				},
				set download(v: string) {
					capturedDownload = v;
				},
				click: clickSpy,
			};
			const createElementSpy = vi
				.spyOn(document, 'createElement')
				.mockReturnValue(fakeAnchor as unknown as HTMLAnchorElement);
			const revokeURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(vi.fn());

			const entities = [
				{ id: '1', title: 'Widget' },
				{ id: '2', title: 'Gadget' },
			];
			service.exportSelected('products', 'json', entities);

			expect(clickSpy).toHaveBeenCalled();
			expect(createElementSpy).toHaveBeenCalledWith('a');
			expect(capturedDownload).toBe('products-selected.json');
			expect(revokeURLSpy).toHaveBeenCalled();

			createElementSpy.mockRestore();
			revokeURLSpy.mockRestore();
		});
	});

	// ============================================
	// parseFile
	// ============================================

	describe('parseFile', () => {
		it('should parse a .json file and return docs array', async () => {
			const content = JSON.stringify([{ title: 'A' }, { title: 'B' }]);
			const file = new File([content], 'data.json', { type: 'application/json' });

			const result = await service.parseFile(file);

			expect(result.format).toBe('json');
			expect(result.docs).toHaveLength(2);
		});

		it('should parse a .json file with { docs: [...] } wrapper', async () => {
			const content = JSON.stringify({ docs: [{ title: 'A' }] });
			const file = new File([content], 'data.json', { type: 'application/json' });

			const result = await service.parseFile(file);

			expect(result.format).toBe('json');
			expect(result.docs).toHaveLength(1);
		});

		it('should parse a .csv file and return raw data string', async () => {
			const content = 'title,price\nWidget,9.99';
			const file = new File([content], 'data.csv', { type: 'text/csv' });

			const result = await service.parseFile(file);

			expect(result.format).toBe('csv');
			expect(result.data).toBe(content);
		});

		it('should reject unsupported file types', async () => {
			const file = new File(['hello'], 'data.txt', { type: 'text/plain' });

			await expect(service.parseFile(file)).rejects.toThrow('Unsupported file type');
		});

		it('should reject invalid JSON', async () => {
			const file = new File(['{bad json'], 'data.json', { type: 'application/json' });

			await expect(service.parseFile(file)).rejects.toThrow('Invalid JSON');
		});
	});

	// ============================================
	// dryRunImport
	// ============================================

	describe('dryRunImport', () => {
		it('should POST with dryRun=true', async () => {
			const promise = service.dryRunImport('posts', 'json', { docs: [{ title: 'A' }] });

			const req = httpMock.expectOne('/api/posts/import');
			expect(req.request.method).toBe('POST');
			expect(req.request.body['dryRun']).toBe(true);
			expect(req.request.body['format']).toBe('json');

			req.flush({ validation: [{ index: 0, valid: true, errors: [], coerced: {} }], total: 1 });

			const result = await promise;
			expect(result.total).toBe(1);
			expect(result.validation).toHaveLength(1);
		});
	});

	// ============================================
	// importDocuments
	// ============================================

	describe('importDocuments', () => {
		it('should POST without dryRun flag', async () => {
			const promise = service.importDocuments('posts', 'json', { docs: [{ title: 'A' }] });

			const req = httpMock.expectOne('/api/posts/import');
			expect(req.request.method).toBe('POST');
			expect(req.request.body['dryRun']).toBeUndefined();
			expect(req.request.body['format']).toBe('json');

			req.flush({ imported: 1, total: 1, errors: [], docs: [{ id: '1', title: 'A' }] });

			const result = await promise;
			expect(result.imported).toBe(1);
		});

		it('should handle import with errors', async () => {
			const promise = service.importDocuments('posts', 'json', { docs: [{ title: 'A' }, {}] });

			const req = httpMock.expectOne('/api/posts/import');
			req.flush({
				imported: 1,
				total: 2,
				errors: [{ index: 1, message: 'Missing required field' }],
				docs: [{ id: '1', title: 'A' }],
			});

			const result = await promise;
			expect(result.imported).toBe(1);
			expect(result.errors).toHaveLength(1);
		});
	});
});
