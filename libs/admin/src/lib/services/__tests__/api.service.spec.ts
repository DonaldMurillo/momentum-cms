import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MomentumApiService, type ApiResponse } from '../api.service';

describe('MomentumApiService', () => {
	let service: MomentumApiService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		});

		service = TestBed.inject(MomentumApiService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	describe('findAll', () => {
		it('should GET /api/{collection} and return docs array', () => {
			const mockDocs = [{ id: '1', title: 'Test' }];

			service.findAll('posts').subscribe((result) => {
				expect(result).toEqual(mockDocs);
			});

			const req = httpMock.expectOne('/api/posts');
			expect(req.request.method).toBe('GET');
			req.flush({ docs: mockDocs } satisfies ApiResponse<Record<string, unknown>>);
		});

		it('should return empty array when docs is missing', () => {
			service.findAll('posts').subscribe((result) => {
				expect(result).toEqual([]);
			});

			const req = httpMock.expectOne('/api/posts');
			req.flush({});
		});
	});

	describe('findById', () => {
		it('should GET /api/{collection}/{id} and return doc', () => {
			const mockDoc = { id: '1', title: 'Test' };

			service.findById('posts', '1').subscribe((result) => {
				expect(result).toEqual(mockDoc);
			});

			const req = httpMock.expectOne('/api/posts/1');
			expect(req.request.method).toBe('GET');
			req.flush({ doc: mockDoc });
		});

		it('should return null when doc is missing', () => {
			service.findById('posts', '999').subscribe((result) => {
				expect(result).toBeNull();
			});

			const req = httpMock.expectOne('/api/posts/999');
			req.flush({});
		});
	});

	describe('create', () => {
		it('should POST /api/{collection} with data', () => {
			const newDoc = { title: 'New Post' };
			const createdDoc = { id: '2', title: 'New Post' };

			service.create('posts', newDoc).subscribe((result) => {
				expect(result).toEqual(createdDoc);
			});

			const req = httpMock.expectOne('/api/posts');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual(newDoc);
			req.flush({ doc: createdDoc });
		});

		it('should return empty object when doc is missing', () => {
			service.create('posts', {}).subscribe((result) => {
				expect(result).toEqual({});
			});

			const req = httpMock.expectOne('/api/posts');
			req.flush({});
		});
	});

	describe('update', () => {
		it('should PATCH /api/{collection}/{id} with data', () => {
			const updateData = { title: 'Updated' };
			const updatedDoc = { id: '1', title: 'Updated' };

			service.update('posts', '1', updateData).subscribe((result) => {
				expect(result).toEqual(updatedDoc);
			});

			const req = httpMock.expectOne('/api/posts/1');
			expect(req.request.method).toBe('PATCH');
			expect(req.request.body).toEqual(updateData);
			req.flush({ doc: updatedDoc });
		});

		it('should return empty object when doc is missing', () => {
			service.update('posts', '1', {}).subscribe((result) => {
				expect(result).toEqual({});
			});

			const req = httpMock.expectOne('/api/posts/1');
			req.flush({});
		});
	});

	describe('delete', () => {
		it('should DELETE /api/{collection}/{id}', () => {
			service.delete('posts', '1').subscribe((result) => {
				expect(result).toBe(true);
			});

			const req = httpMock.expectOne('/api/posts/1');
			expect(req.request.method).toBe('DELETE');
			req.flush({ deleted: true });
		});

		it('should return false when deleted is missing', () => {
			service.delete('posts', '1').subscribe((result) => {
				expect(result).toBe(false);
			});

			const req = httpMock.expectOne('/api/posts/1');
			req.flush({});
		});
	});
});
