import { describe, it, expect } from 'vitest';
import { generateRobotsTxt } from '../robots-txt-generator';

describe('generateRobotsTxt — newline injection prevention', () => {
	it('should strip newlines from userAgent values', () => {
		const txt = generateRobotsTxt('https://example.com', {
			rules: [{ userAgent: 'Googlebot\nDisallow: /', allow: ['/'], disallow: [] }],
		});
		expect(txt).not.toContain('Googlebot\nDisallow');
		expect(txt).toContain('User-agent: GooglebotDisallow: /');
	});

	it('should strip carriage returns from userAgent values', () => {
		const txt = generateRobotsTxt('https://example.com', {
			rules: [{ userAgent: 'Bot\r\nDisallow: /secret', allow: [], disallow: [] }],
		});
		expect(txt).not.toContain('\r');
		// After stripping \r\n the injected text is concatenated into the userAgent value,
		// not emitted as a standalone directive line
		const lines = txt.split('\n');
		expect(lines.some((l) => l.trim() === 'Disallow: /secret')).toBe(false);
		expect(txt).toContain('User-agent: BotDisallow: /secret');
	});

	it('should strip newlines from allow paths', () => {
		const txt = generateRobotsTxt('https://example.com', {
			rules: [{ userAgent: '*', allow: ['/public\nDisallow: /'], disallow: [] }],
		});
		const lines = txt.split('\n');
		const allowLine = lines.find((l) => l.startsWith('Allow:'));
		expect(allowLine).toBe('Allow: /publicDisallow: /');
	});

	it('should strip newlines from disallow paths', () => {
		const txt = generateRobotsTxt('https://example.com', {
			rules: [{ userAgent: '*', allow: [], disallow: ['/admin\nAllow: /'] }],
		});
		const lines = txt.split('\n');
		const disallowLine = lines.find((l) => l.startsWith('Disallow:'));
		expect(disallowLine).toBe('Disallow: /adminAllow: /');
	});

	it('should strip newlines from additional sitemap URLs', () => {
		const txt = generateRobotsTxt('https://example.com', {
			additionalSitemaps: ['https://evil.com/sitemap.xml\nDisallow: /'],
		});
		expect(txt).not.toContain('\nDisallow: /');
		expect(txt).toContain('Sitemap: https://evil.com/sitemap.xmlDisallow: /');
	});
});
