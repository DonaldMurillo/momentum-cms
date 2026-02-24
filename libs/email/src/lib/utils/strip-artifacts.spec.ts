import { describe, it, expect } from 'vitest';
import { stripAngularArtifacts } from './strip-artifacts';

describe('stripAngularArtifacts', () => {
	it('should remove HTML comments', () => {
		const html = '<div><!-- ng-container --><p>Hello</p><!-- end --></div>';
		expect(stripAngularArtifacts(html)).toBe('<div><p>Hello</p></div>');
	});

	it('should remove ng-reflect attributes', () => {
		const html = '<p ng-reflect-font-size="14" style="font-size: 14px;">Text</p>';
		expect(stripAngularArtifacts(html)).toBe('<p style="font-size: 14px;">Text</p>');
	});

	it('should remove _nghost attributes', () => {
		const html = '<div _nghost-ng-c123456="">Content</div>';
		expect(stripAngularArtifacts(html)).toBe('<div>Content</div>');
	});

	it('should remove _ngcontent attributes', () => {
		const html = '<p _ngcontent-ng-c789="">Text</p>';
		expect(stripAngularArtifacts(html)).toBe('<p>Text</p>');
	});

	it('should remove ng-version attribute', () => {
		const html = '<app-root ng-version="21.1.0"><p>App</p></app-root>';
		expect(stripAngularArtifacts(html)).toBe('<app-root><p>App</p></app-root>');
	});

	it('should remove ng-server-context attribute', () => {
		const html = '<html ng-server-context="ssr"><body>Content</body></html>';
		expect(stripAngularArtifacts(html)).toBe('<html><body>Content</body></html>');
	});

	it('should remove ngh hydration attribute', () => {
		const html = '<div ngh="0"><p>Text</p></div>';
		expect(stripAngularArtifacts(html)).toBe('<div><p>Text</p></div>');
	});

	it('should handle multiple artifacts in one string', () => {
		const html =
			'<!-- comment --><div _nghost-abc="" ng-reflect-foo="bar" ng-version="21"><p _ngcontent-abc="">Hi</p></div>';
		const result = stripAngularArtifacts(html);
		expect(result).toBe('<div><p>Hi</p></div>');
		expect(result).not.toContain('ng-');
		expect(result).not.toContain('_ng');
		expect(result).not.toContain('<!--');
	});

	it('should leave clean HTML unchanged', () => {
		const html = '<table><tr><td>Hello</td></tr></table>';
		expect(stripAngularArtifacts(html)).toBe(html);
	});
});
