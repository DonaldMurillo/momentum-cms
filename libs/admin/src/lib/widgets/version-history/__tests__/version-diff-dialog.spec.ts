import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA } from '@momentumcms/ui';
import {
	VersionDiffDialogComponent,
	type VersionDiffDialogData,
} from '../version-diff-dialog.component';
import { VersionService, type VersionFieldDiff } from '../../../services/version.service';
import { vi } from 'vitest';

class MockVersionService {
	compareVersions = vi.fn();
}

describe('VersionDiffDialogComponent', () => {
	let component: VersionDiffDialogComponent;
	let mockVersionService: MockVersionService;

	const dialogData: VersionDiffDialogData = {
		collection: 'posts',
		documentId: 'doc-1',
		versionId1: 'v1',
		versionId2: 'v2',
		label1: 'Version 1',
		label2: 'Version 2',
	};

	beforeEach(async () => {
		mockVersionService = new MockVersionService();
		mockVersionService.compareVersions.mockResolvedValue([]);

		await TestBed.configureTestingModule({
			imports: [VersionDiffDialogComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: dialogData },
				{ provide: VersionService, useValue: mockVersionService },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should have correct dialog data', () => {
		expect(component.data.collection).toBe('posts');
		expect(component.data.label1).toBe('Version 1');
		expect(component.data.label2).toBe('Version 2');
	});

	it('should start in loading state', () => {
		// Note: constructor already called loadDifferences
		expect(component.isLoading()).toBeDefined();
	});

	it('should load differences on construction', async () => {
		const diffs: VersionFieldDiff[] = [
			{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' },
			{ field: 'status', oldValue: null, newValue: 'published' },
		];
		mockVersionService.compareVersions.mockResolvedValue(diffs);

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		const comp = fixture.componentInstance;

		// Wait for loadDifferences to complete
		await vi.waitFor(() => {
			expect(comp.isLoading()).toBe(false);
		});

		expect(comp.differences()).toEqual(diffs);
		expect(comp.error()).toBeNull();
	});

	it('should handle error when loading differences fails', async () => {
		mockVersionService.compareVersions.mockRejectedValue(new Error('Network error'));

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		const comp = fixture.componentInstance;

		await vi.waitFor(() => {
			expect(comp.isLoading()).toBe(false);
		});

		expect(comp.error()).toBe('Failed to compare versions');
		expect(comp.differences()).toEqual([]);
	});

	describe('formatValue', () => {
		it('should return strings as-is', () => {
			expect(component.formatValue('hello')).toBe('hello');
		});

		it('should convert numbers to string', () => {
			expect(component.formatValue(42)).toBe('42');
		});

		it('should convert booleans to string', () => {
			expect(component.formatValue(true)).toBe('true');
			expect(component.formatValue(false)).toBe('false');
		});

		it('should JSON.stringify objects', () => {
			const obj = { key: 'value' };
			expect(component.formatValue(obj)).toBe(JSON.stringify(obj, null, 2));
		});

		it('should JSON.stringify arrays', () => {
			const arr = [1, 2, 3];
			expect(component.formatValue(arr)).toBe(JSON.stringify(arr, null, 2));
		});

		it('should handle null', () => {
			expect(component.formatValue(null)).toBe('null');
		});
	});
});
