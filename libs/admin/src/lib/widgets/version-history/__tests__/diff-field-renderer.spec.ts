import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { DeepDiffResult } from '@momentumcms/core';
import { DiffFieldRendererComponent } from '../diff-field-renderer.component';

describe('DiffFieldRendererComponent', () => {
	let fixture: ComponentFixture<DiffFieldRendererComponent>;
	let component: DiffFieldRendererComponent;

	function createComponent(diff: DeepDiffResult, mode: 'inline' | 'side-by-side' = 'inline') {
		fixture = TestBed.createComponent(DiffFieldRendererComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('diff', diff);
		fixture.componentRef.setInput('mode', mode);
		fixture.detectChanges();
		return fixture;
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DiffFieldRendererComponent],
			providers: [provideHttpClient(), provideHttpClientTesting()],
		}).compileComponents();
	});

	it('should create', () => {
		createComponent({ field: 'title', changeType: 'changed', oldValue: 'Old', newValue: 'New' });
		expect(component).toBeTruthy();
	});

	describe('changeType badge rendering', () => {
		it('should render "added" badge for added fields', () => {
			const fix = createComponent({ field: 'title', changeType: 'added', newValue: 'New' });
			const badge = fix.nativeElement.querySelector('[data-testid="diff-badge-added"]');
			expect(badge).toBeTruthy();
			expect(badge?.textContent?.trim()).toBe('added');
		});

		it('should render "removed" badge for removed fields', () => {
			const fix = createComponent({ field: 'title', changeType: 'removed', oldValue: 'Old' });
			const badge = fix.nativeElement.querySelector('[data-testid="diff-badge-removed"]');
			expect(badge).toBeTruthy();
			expect(badge?.textContent?.trim()).toBe('removed');
		});

		it('should render "changed" badge for changed fields', () => {
			const fix = createComponent({
				field: 'title',
				changeType: 'changed',
				oldValue: 'Old',
				newValue: 'New',
			});
			const badge = fix.nativeElement.querySelector('[data-testid="diff-badge-changed"]');
			expect(badge).toBeTruthy();
			expect(badge?.textContent?.trim()).toBe('changed');
		});

		it('should not render any change badge for unchanged fields', () => {
			const fix = createComponent({ field: 'title', changeType: 'unchanged' });
			const el = fix.nativeElement;
			expect(el.querySelector('[data-testid="diff-badge-added"]')).toBeNull();
			expect(el.querySelector('[data-testid="diff-badge-removed"]')).toBeNull();
			expect(el.querySelector('[data-testid="diff-badge-changed"]')).toBeNull();
		});
	});

	describe('label display', () => {
		it('should display label when provided', () => {
			const fix = createComponent({ field: 'title', label: 'Title Field', changeType: 'changed' });
			const badge = fix.nativeElement.querySelector('mcms-badge[variant="outline"]');
			expect(badge?.textContent?.trim()).toBe('Title Field');
		});

		it('should fall back to field name when label is not provided', () => {
			const fix = createComponent({ field: 'my_field', changeType: 'changed' });
			const badge = fix.nativeElement.querySelector('mcms-badge[variant="outline"]');
			expect(badge?.textContent?.trim()).toBe('my_field');
		});
	});

	describe('inline mode - text diff with word-level segments', () => {
		it('should render text diff segments with ins/del elements', () => {
			const fix = createComponent({
				field: 'content',
				changeType: 'changed',
				textDiff: [
					{ type: 'common', value: 'Hello' },
					{ type: 'removed', value: 'world' },
					{ type: 'added', value: 'there' },
				],
			});
			const segmentsContainer = fix.nativeElement.querySelector(
				'[data-testid="diff-text-segments"]',
			);
			expect(segmentsContainer).toBeTruthy();

			const delEl = segmentsContainer?.querySelector('del');
			expect(delEl?.textContent).toBe('world');

			const insEl = segmentsContainer?.querySelector('ins');
			expect(insEl?.textContent).toBe('there');

			const spans = segmentsContainer?.querySelectorAll(':scope > span') as
				| NodeListOf<HTMLElement>
				| undefined;
			const commonSpan = Array.from(spans ?? []).find((s) => s.textContent?.includes('Hello'));
			expect(commonSpan).toBeTruthy();
		});

		it('should show inline container, not side-by-side', () => {
			const fix = createComponent({
				field: 'content',
				changeType: 'changed',
				textDiff: [{ type: 'common', value: 'Hello' }],
			});
			expect(fix.nativeElement.querySelector('[data-testid="diff-inline"]')).toBeTruthy();
			expect(fix.nativeElement.querySelector('[data-testid="diff-side-by-side"]')).toBeNull();
		});
	});

	describe('side-by-side mode', () => {
		it('should render side-by-side layout', () => {
			const fix = createComponent(
				{ field: 'title', changeType: 'changed', oldValue: 'Old Title', newValue: 'New Title' },
				'side-by-side',
			);
			expect(fix.nativeElement.querySelector('[data-testid="diff-side-by-side"]')).toBeTruthy();
			expect(fix.nativeElement.querySelector('[data-testid="diff-inline"]')).toBeNull();
		});

		it('should show old value in left column and new value in right column', () => {
			const fix = createComponent(
				{ field: 'title', changeType: 'changed', oldValue: 'Old Title', newValue: 'New Title' },
				'side-by-side',
			);
			const oldEl = fix.nativeElement.querySelector('[data-testid="diff-old-value"]');
			const newEl = fix.nativeElement.querySelector('[data-testid="diff-new-value"]');
			expect(oldEl?.textContent?.trim()).toContain('Old Title');
			expect(newEl?.textContent?.trim()).toContain('New Title');
		});

		it('should not show old value when changeType is added', () => {
			const fix = createComponent(
				{ field: 'title', changeType: 'added', newValue: 'New Value' },
				'side-by-side',
			);
			const oldEl = fix.nativeElement.querySelector('[data-testid="diff-old-value"]');
			const newEl = fix.nativeElement.querySelector('[data-testid="diff-new-value"]');
			expect(oldEl?.textContent?.trim()).toBe('');
			expect(newEl?.textContent?.trim()).toContain('New Value');
		});

		it('should not show new value when changeType is removed', () => {
			const fix = createComponent(
				{ field: 'title', changeType: 'removed', oldValue: 'Old Value' },
				'side-by-side',
			);
			const oldEl = fix.nativeElement.querySelector('[data-testid="diff-old-value"]');
			const newEl = fix.nativeElement.querySelector('[data-testid="diff-new-value"]');
			expect(oldEl?.textContent?.trim()).toContain('Old Value');
			expect(newEl?.textContent?.trim()).toBe('');
		});
	});

	describe('array changes rendering', () => {
		it('should render array changes container', () => {
			const fix = createComponent({
				field: 'tags',
				changeType: 'changed',
				arrayChanges: [
					{ index: 0, changeType: 'removed', oldValue: 'angular' },
					{ index: 1, changeType: 'added', newValue: 'react' },
					{ index: 2, changeType: 'changed', oldValue: 'old', newValue: 'new' },
				],
			});
			const arrayContainer = fix.nativeElement.querySelector('[data-testid="diff-array-changes"]');
			expect(arrayContainer).toBeTruthy();
		});

		it('should show item index and change type badge for each array item', () => {
			const fix = createComponent({
				field: 'tags',
				changeType: 'changed',
				arrayChanges: [{ index: 0, changeType: 'added', newValue: 'new-tag' }],
			});
			const arrayContainer = fix.nativeElement.querySelector('[data-testid="diff-array-changes"]');
			expect(arrayContainer?.textContent).toContain('Item 0');
			expect(arrayContainer?.textContent).toContain('added');
		});

		it('should render old and new values for array items without children', () => {
			const fix = createComponent({
				field: 'tags',
				changeType: 'changed',
				arrayChanges: [
					{ index: 0, changeType: 'changed', oldValue: 'old-tag', newValue: 'new-tag' },
				],
			});
			const arrayContainer = fix.nativeElement.querySelector('[data-testid="diff-array-changes"]');
			expect(arrayContainer?.textContent).toContain('old-tag');
			expect(arrayContainer?.textContent).toContain('new-tag');
		});

		it('should render child diffs for array items with children', () => {
			const fix = createComponent({
				field: 'blocks',
				changeType: 'changed',
				arrayChanges: [
					{
						index: 0,
						changeType: 'changed',
						children: [
							{ field: 'text', changeType: 'changed', oldValue: 'Old text', newValue: 'New text' },
						],
					},
				],
			});
			const arrayContainer = fix.nativeElement.querySelector('[data-testid="diff-array-changes"]');
			const nestedRenderer = arrayContainer?.querySelector('mcms-diff-field-renderer');
			expect(nestedRenderer).toBeTruthy();
		});
	});

	describe('group children rendering (recursive)', () => {
		it('should render children container for group fields', () => {
			const fix = createComponent({
				field: 'seo',
				changeType: 'changed',
				children: [
					{ field: 'title', changeType: 'changed', oldValue: 'Old SEO', newValue: 'New SEO' },
					{
						field: 'description',
						changeType: 'changed',
						oldValue: 'Old desc',
						newValue: 'New desc',
					},
				],
			});
			const childrenContainer = fix.nativeElement.querySelector('[data-testid="diff-children"]');
			expect(childrenContainer).toBeTruthy();
			const nestedRenderers = childrenContainer?.querySelectorAll('mcms-diff-field-renderer');
			expect(nestedRenderers?.length).toBe(2);
		});

		it('should skip unchanged children in group rendering', () => {
			const fix = createComponent({
				field: 'seo',
				changeType: 'changed',
				children: [
					{ field: 'title', changeType: 'changed', oldValue: 'Old', newValue: 'New' },
					{ field: 'description', changeType: 'unchanged' },
				],
			});
			const childrenContainer = fix.nativeElement.querySelector('[data-testid="diff-children"]');
			const nestedRenderers = childrenContainer?.querySelectorAll('mcms-diff-field-renderer');
			expect(nestedRenderers?.length).toBe(1);
		});
	});

	describe('fallback mode (unknown field types)', () => {
		it('should show old/new blocks when no textDiff, children, or arrayChanges', () => {
			const fix = createComponent({
				field: 'custom_field',
				changeType: 'changed',
				oldValue: 'old-val',
				newValue: 'new-val',
			});
			const inline = fix.nativeElement.querySelector('[data-testid="diff-inline"]');
			expect(inline).toBeTruthy();

			const oldEl = inline?.querySelector('[data-testid="diff-old-value"]');
			const newEl = inline?.querySelector('[data-testid="diff-new-value"]');
			expect(oldEl?.textContent).toContain('old-val');
			expect(newEl?.textContent).toContain('new-val');
		});

		it('should not render old value block when oldValue is null', () => {
			const fix = createComponent({
				field: 'custom_field',
				changeType: 'added',
				oldValue: null,
				newValue: 'new-val',
			});
			const inline = fix.nativeElement.querySelector('[data-testid="diff-inline"]');
			expect(inline?.querySelector('[data-testid="diff-old-value"]')).toBeNull();
			expect(inline?.querySelector('[data-testid="diff-new-value"]')).toBeTruthy();
		});

		it('should not render new value block when newValue is undefined', () => {
			const fix = createComponent({
				field: 'custom_field',
				changeType: 'removed',
				oldValue: 'old-val',
			});
			const inline = fix.nativeElement.querySelector('[data-testid="diff-inline"]');
			expect(inline?.querySelector('[data-testid="diff-old-value"]')).toBeTruthy();
			expect(inline?.querySelector('[data-testid="diff-new-value"]')).toBeNull();
		});
	});

	describe('formatValue()', () => {
		it('should return string values as-is', () => {
			createComponent({ field: 'f', changeType: 'unchanged' });
			expect(component.formatValue('hello')).toBe('hello');
		});

		it('should convert numbers to string', () => {
			createComponent({ field: 'f', changeType: 'unchanged' });
			expect(component.formatValue(42)).toBe('42');
		});

		it('should convert booleans to string', () => {
			createComponent({ field: 'f', changeType: 'unchanged' });
			expect(component.formatValue(true)).toBe('true');
			expect(component.formatValue(false)).toBe('false');
		});

		it('should return empty string for null', () => {
			createComponent({ field: 'f', changeType: 'unchanged' });
			expect(component.formatValue(null)).toBe('');
		});

		it('should return empty string for undefined', () => {
			createComponent({ field: 'f', changeType: 'unchanged' });
			expect(component.formatValue(undefined)).toBe('');
		});

		it('should JSON.stringify objects', () => {
			createComponent({ field: 'f', changeType: 'unchanged' });
			const result = component.formatValue({ key: 'value' });
			expect(result).toBe(JSON.stringify({ key: 'value' }, null, 2));
		});

		it('should JSON.stringify arrays', () => {
			createComponent({ field: 'f', changeType: 'unchanged' });
			const result = component.formatValue([1, 2, 3]);
			expect(result).toBe(JSON.stringify([1, 2, 3], null, 2));
		});
	});

	describe('computed signals', () => {
		it('isTextDiff should be true when textDiff has segments', () => {
			createComponent({
				field: 'content',
				changeType: 'changed',
				textDiff: [{ type: 'common', value: 'text' }],
			});
			expect(component.isTextDiff()).toBe(true);
		});

		it('isTextDiff should be false when textDiff is empty', () => {
			createComponent({
				field: 'content',
				changeType: 'changed',
				textDiff: [],
			});
			expect(component.isTextDiff()).toBe(false);
		});

		it('isTextDiff should be false when textDiff is undefined', () => {
			createComponent({ field: 'content', changeType: 'changed' });
			expect(component.isTextDiff()).toBe(false);
		});

		it('hasChildren should be true when children exist', () => {
			createComponent({
				field: 'group',
				changeType: 'changed',
				children: [{ field: 'sub', changeType: 'changed' }],
			});
			expect(component.hasChildren()).toBe(true);
		});

		it('hasChildren should be false when children is empty', () => {
			createComponent({ field: 'group', changeType: 'changed', children: [] });
			expect(component.hasChildren()).toBe(false);
		});

		it('hasArrayChanges should be true when arrayChanges exist', () => {
			createComponent({
				field: 'arr',
				changeType: 'changed',
				arrayChanges: [{ index: 0, changeType: 'added', newValue: 'x' }],
			});
			expect(component.hasArrayChanges()).toBe(true);
		});

		it('hasArrayChanges should be false when arrayChanges is empty', () => {
			createComponent({ field: 'arr', changeType: 'changed', arrayChanges: [] });
			expect(component.hasArrayChanges()).toBe(false);
		});
	});

	describe('data-testid attributes', () => {
		it('should set data-testid based on field name', () => {
			const fix = createComponent({ field: 'my_field', changeType: 'changed' });
			const container = fix.nativeElement.querySelector('[data-testid="diff-field-my_field"]');
			expect(container).toBeTruthy();
		});
	});
});
