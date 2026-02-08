import { describe, it, expect } from 'vitest';
import { prettyFormatter, jsonFormatter, type LogEntry } from '../formatters';

describe('formatters', () => {
	const fixedDate = new Date('2026-02-07T10:23:45.123Z');

	function createEntry(overrides: Partial<LogEntry> = {}): LogEntry {
		return {
			timestamp: fixedDate,
			level: 'info',
			context: 'Momentum:DB',
			message: 'Test message',
			...overrides,
		};
	}

	describe('prettyFormatter', () => {
		it('should include timestamp, level, context, and message', () => {
			// Force NO_COLOR to get predictable output
			process.env['NO_COLOR'] = '';
			const result = prettyFormatter(createEntry());
			expect(result).toContain('INFO');
			expect(result).toContain('[Momentum:DB]');
			expect(result).toContain('Test message');
			expect(result).toContain('.123');
			expect(result.endsWith('\n')).toBe(true);
			delete process.env['NO_COLOR'];
		});

		it('should pad level to 5 characters for alignment', () => {
			process.env['NO_COLOR'] = '';
			const infoResult = prettyFormatter(createEntry({ level: 'info' }));
			const warnResult = prettyFormatter(createEntry({ level: 'warn' }));
			// Both should have 5-char level badges
			expect(infoResult).toContain('INFO ');
			expect(warnResult).toContain('WARN ');
			delete process.env['NO_COLOR'];
		});

		it('should include data as key=value pairs', () => {
			process.env['NO_COLOR'] = '';
			const result = prettyFormatter(createEntry({ data: { userId: '123', action: 'create' } }));
			expect(result).toContain('userId=123');
			expect(result).toContain('action=create');
			delete process.env['NO_COLOR'];
		});

		it('should include enrichments', () => {
			process.env['NO_COLOR'] = '';
			const result = prettyFormatter(createEntry({ enrichments: { traceId: 'abc-123' } }));
			expect(result).toContain('traceId=abc-123');
			delete process.env['NO_COLOR'];
		});

		it('should apply ANSI colors when color is supported', () => {
			process.env['FORCE_COLOR'] = '1';
			delete process.env['NO_COLOR'];
			const result = prettyFormatter(createEntry());
			// Should contain ANSI escape codes
			expect(result).toContain('\x1b[');
			delete process.env['FORCE_COLOR'];
		});
	});

	describe('jsonFormatter', () => {
		it('should produce valid JSON', () => {
			const result = jsonFormatter(createEntry());
			const parsed = JSON.parse(result.trim());
			expect(parsed).toBeDefined();
		});

		it('should include all required fields', () => {
			const result = jsonFormatter(createEntry());
			const parsed = JSON.parse(result.trim());
			expect(parsed.timestamp).toBe('2026-02-07T10:23:45.123Z');
			expect(parsed.level).toBe('info');
			expect(parsed.context).toBe('Momentum:DB');
			expect(parsed.message).toBe('Test message');
		});

		it('should include data when present', () => {
			const result = jsonFormatter(createEntry({ data: { userId: '123' } }));
			const parsed = JSON.parse(result.trim());
			expect(parsed.data).toEqual({ userId: '123' });
		});

		it('should not include data key when data is absent', () => {
			const result = jsonFormatter(createEntry());
			const parsed = JSON.parse(result.trim());
			expect(parsed).not.toHaveProperty('data');
		});

		it('should merge enrichments into top-level', () => {
			const result = jsonFormatter(createEntry({ enrichments: { traceId: 'abc' } }));
			const parsed = JSON.parse(result.trim());
			expect(parsed.traceId).toBe('abc');
		});

		it('should end with a newline', () => {
			const result = jsonFormatter(createEntry());
			expect(result.endsWith('\n')).toBe(true);
		});
	});
});
