/**
 * Log entry formatters for pretty (colorful) and JSON output.
 */

import type { LogLevel } from './log-level';
import { ANSI, colorize, supportsColor } from './ansi-colors';

export interface LogEntry {
	timestamp: Date;
	level: LogLevel;
	context: string;
	message: string;
	data?: Record<string, unknown>;
	enrichments?: Record<string, unknown>;
}

export type LogFormatter = (entry: LogEntry) => string;

const LEVEL_COLORS: Record<Exclude<LogLevel, 'silent'>, string[]> = {
	debug: [ANSI.dim, ANSI.gray],
	info: [ANSI.cyan],
	warn: [ANSI.yellow],
	error: [ANSI.red],
	fatal: [ANSI.bold, ANSI.white, ANSI.bgRed],
};

/**
 * Pads the level name to 5 characters for alignment.
 */
function padLevel(level: string): string {
	return level.toUpperCase().padEnd(5);
}

/**
 * Formats a timestamp as YYYY-MM-DD HH:mm:ss.SSS.
 */
function formatTimestamp(date: Date): string {
	const y = date.getFullYear();
	const mo = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	const h = String(date.getHours()).padStart(2, '0');
	const mi = String(date.getMinutes()).padStart(2, '0');
	const s = String(date.getSeconds()).padStart(2, '0');
	const ms = String(date.getMilliseconds()).padStart(3, '0');
	return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}

/**
 * Formats extra data as a single-line key=value string.
 */
function formatData(data: Record<string, unknown>): string {
	const entries = Object.entries(data);
	if (entries.length === 0) return '';
	return (
		' ' + entries.map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')
	);
}

/**
 * Pretty formatter with colorful aligned output.
 *
 * Output: `2026-02-07 10:23:45.123  INFO  [Momentum:DB] Message here`
 */
export function prettyFormatter(entry: LogEntry): string {
	const useColor = supportsColor();
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- 'silent' level is never logged
	const level = entry.level as Exclude<LogLevel, 'silent'>;

	const ts = formatTimestamp(entry.timestamp);
	const levelStr = padLevel(entry.level);
	const ctx = `[${entry.context}]`;
	const msg = entry.message;

	const enrichmentStr = entry.enrichments ? formatData(entry.enrichments) : '';
	const dataStr = entry.data ? formatData(entry.data) : '';
	const extra = `${enrichmentStr}${dataStr}`;

	if (useColor) {
		const colors = LEVEL_COLORS[level];
		const coloredLevel = colorize(levelStr, ...colors);
		const coloredCtx = colorize(ctx, ANSI.magenta);
		const coloredTs = colorize(ts, ANSI.gray);
		return `${coloredTs} ${coloredLevel} ${coloredCtx} ${msg}${extra}\n`;
	}

	return `${ts} ${levelStr} ${ctx} ${msg}${extra}\n`;
}

/**
 * JSON formatter for structured logging.
 *
 * Output: `{"timestamp":"...","level":"info","context":"Momentum:DB","message":"..."}`
 */
export function jsonFormatter(entry: LogEntry): string {
	const output: Record<string, unknown> = {
		timestamp: entry.timestamp.toISOString(),
		level: entry.level,
		context: entry.context,
		message: entry.message,
	};

	if (entry.enrichments && Object.keys(entry.enrichments).length > 0) {
		Object.assign(output, entry.enrichments);
	}

	if (entry.data && Object.keys(entry.data).length > 0) {
		output['data'] = entry.data;
	}

	return JSON.stringify(output) + '\n';
}
