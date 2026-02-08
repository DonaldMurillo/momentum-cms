/**
 * ANSI escape codes for colorful terminal output.
 * Built from scratch — no external dependencies.
 */

export const ANSI = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',

	// Foreground colors
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
	gray: '\x1b[90m',

	// Background colors
	bgRed: '\x1b[41m',
	bgYellow: '\x1b[43m',
} as const;

/**
 * Wraps text with ANSI escape codes and a reset suffix.
 */
export function colorize(text: string, ...codes: string[]): string {
	if (codes.length === 0) return text;
	return `${codes.join('')}${text}${ANSI.reset}`;
}

/**
 * Checks if the current environment supports color output.
 * Respects NO_COLOR and FORCE_COLOR environment variables.
 */
export function supportsColor(): boolean {
	if (process.env['FORCE_COLOR'] === '1') return true;
	if (process.env['NO_COLOR'] !== undefined) return false;
	if (process.env['TERM'] === 'dumb') return false;
	return process.stdout.isTTY === true;
}
