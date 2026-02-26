import { describe, it, expect } from 'vitest';
import { renderPreviewHTML } from './preview-renderer';
import type { CollectionConfig } from '@momentumcms/core';

const mockCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		{ name: 'title', type: 'text', label: 'Title' },
		{ name: 'content', type: 'richText', label: 'Content' },
	],
	admin: { useAsTitle: 'title' },
};

describe('renderPreviewHTML', () => {
	it('should escape HTML in rich text fields to prevent XSS', () => {
		const html = renderPreviewHTML({
			doc: {
				id: '1',
				title: 'Test Post',
				content: '<script>alert("xss")</script>',
			},
			collection: mockCollection,
		});
		expect(html).not.toContain('<script>alert');
		expect(html).toContain('&lt;script&gt;');
	});

	it('should escape rich text img onerror payloads', () => {
		const html = renderPreviewHTML({
			doc: {
				id: '1',
				title: 'Test Post',
				content: '<img src=x onerror=alert(1)>',
			},
			collection: mockCollection,
		});
		// The raw <img> tag must not appear as an actual HTML element
		expect(html).not.toContain('<img src=x');
		expect(html).toContain('&lt;img');
	});

	it('should render basic document structure', () => {
		const html = renderPreviewHTML({
			doc: { id: '1', title: 'Hello World', content: 'Some text' },
			collection: mockCollection,
		});
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('Hello World');
		expect(html).toContain('Some text');
	});

	it('should escape title field to prevent XSS', () => {
		const html = renderPreviewHTML({
			doc: {
				id: '1',
				title: '<script>alert("title")</script>',
				content: 'safe content',
			},
			collection: mockCollection,
		});
		expect(html).not.toContain('<script>alert("title")');
		expect(html).toContain('&lt;script&gt;');
	});

	it('should include origin check in postMessage handler', () => {
		const html = renderPreviewHTML({
			doc: { id: '1', title: 'Test', content: 'Safe' },
			collection: mockCollection,
		});
		expect(html).toContain('e.origin!==window.location.origin');
	});

	it('should escape text field values', () => {
		const textCollection: CollectionConfig = {
			slug: 'pages',
			fields: [
				{ name: 'title', type: 'text', label: 'Title' },
				{ name: 'description', type: 'text', label: 'Description' },
			],
			admin: { useAsTitle: 'title' },
		};
		const html = renderPreviewHTML({
			doc: { id: '1', title: 'Test', description: '<b>bold</b>' },
			collection: textCollection,
		});
		expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
	});
});
