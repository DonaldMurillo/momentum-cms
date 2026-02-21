import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import type { Field } from '@momentumcms/core';
import { GroupFieldRenderer } from '../group-field.component';
import { createMockField } from './test-helpers';

describe('GroupFieldRenderer', () => {
	let fixture: ComponentFixture<GroupFieldRenderer>;
	let component: GroupFieldRenderer;

	function setup(fieldOverrides: Record<string, unknown> = {}): void {
		TestBed.configureTestingModule({
			imports: [GroupFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(GroupFieldRenderer);
		component = fixture.componentInstance;

		fixture.componentRef.setInput(
			'field',
			createMockField('group', {
				name: 'seo',
				label: 'SEO Settings',
				fields: [
					createMockField('text', { name: 'metaTitle', label: 'Meta Title' }),
					createMockField('text', { name: 'metaDescription', label: 'Meta Description' }),
				] as unknown as Field[],
				...fieldOverrides,
			}),
		);
		fixture.componentRef.setInput('path', 'seo');
		fixture.detectChanges();
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('label', () => {
		it('should use field label when provided', () => {
			setup({ label: 'SEO Settings' });
			expect(component.label()).toBe('SEO Settings');
		});

		it('should humanize field name when no label', () => {
			setup({ label: '', name: 'seoSettings' });
			expect(component.label()).toBe('Seo Settings');
		});
	});

	describe('description', () => {
		it('should return description when provided', () => {
			setup({ description: 'Configure search engine optimization fields' });
			expect(component.description()).toBe('Configure search engine optimization fields');
		});

		it('should return empty string when no description', () => {
			setup();
			expect(component.description()).toBe('');
		});
	});

	describe('collapsible', () => {
		it('should be false by default', () => {
			setup();
			expect(component.collapsible()).toBe(false);
		});

		it('should be true when admin.collapsible is set', () => {
			setup({ admin: { collapsible: true } });
			expect(component.collapsible()).toBe(true);
		});
	});

	describe('panelId', () => {
		it('should generate from path', () => {
			setup();
			expect(component.panelId()).toBe('group-seo');
		});

		it('should replace dots with dashes in path', () => {
			setup();
			fixture.componentRef.setInput('path', 'content.seo.meta');
			fixture.detectChanges();
			expect(component.panelId()).toBe('group-content-seo-meta');
		});
	});

	describe('subFields', () => {
		it('should return sub-fields for group type', () => {
			setup();
			const fields = component.subFields();
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('metaTitle');
			expect(fields[1].name).toBe('metaDescription');
		});

		it('should filter hidden sub-fields', () => {
			setup({
				fields: [
					createMockField('text', { name: 'metaTitle', label: 'Meta Title' }),
					createMockField('text', {
						name: 'hiddenField',
						label: 'Hidden',
						admin: { hidden: true },
					}),
					createMockField('text', { name: 'metaDescription', label: 'Meta Description' }),
				] as unknown as Field[],
			});
			const fields = component.subFields();
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('metaTitle');
			expect(fields[1].name).toBe('metaDescription');
		});

		it('should return empty array for non-group type', () => {
			TestBed.configureTestingModule({
				imports: [GroupFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(GroupFieldRenderer);
			component = fixture.componentInstance;

			fixture.componentRef.setInput(
				'field',
				createMockField('text', { name: 'title', label: 'Title' }),
			);
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			expect(component.subFields()).toEqual([]);
		});
	});

	describe('isExpanded', () => {
		it('should default to false', () => {
			setup();
			expect(component.isExpanded()).toBe(false);
		});

		it('should be true when collapsible and defaultOpen', () => {
			setup({ admin: { collapsible: true, defaultOpen: true } });
			expect(component.isExpanded()).toBe(true);
		});
	});

	describe('getSubFormNode', () => {
		it('should return sub-node from formNode', () => {
			setup();
			const mockFormNode = {
				metaTitle: 'title-node',
				metaDescription: 'desc-node',
			};
			fixture.componentRef.setInput('formNode', mockFormNode);
			fixture.detectChanges();

			expect(component.getSubFormNode('metaTitle')).toBe('title-node');
			expect(component.getSubFormNode('metaDescription')).toBe('desc-node');
		});

		it('should return null when formNode is null', () => {
			setup();
			fixture.componentRef.setInput('formNode', null);
			fixture.detectChanges();

			expect(component.getSubFormNode('metaTitle')).toBeNull();
		});

		it('should return null for non-existent sub-field', () => {
			setup();
			const mockFormNode = { metaTitle: 'title-node' };
			fixture.componentRef.setInput('formNode', mockFormNode);
			fixture.detectChanges();

			expect(component.getSubFormNode('nonExistent')).toBeNull();
		});
	});

	describe('getSubFieldPath', () => {
		it('should build dotted path', () => {
			setup();
			expect(component.getSubFieldPath('metaTitle')).toBe('seo.metaTitle');
		});

		it('should work with nested paths', () => {
			setup();
			fixture.componentRef.setInput('path', 'content.seo');
			fixture.detectChanges();
			expect(component.getSubFieldPath('metaTitle')).toBe('content.seo.metaTitle');
		});
	});
});
