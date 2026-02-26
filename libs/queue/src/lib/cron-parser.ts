/**
 * Minimal 5-field cron expression parser.
 * Supports: minute hour day-of-month month day-of-week
 *
 * Features:
 * - Wildcards: *
 * - Ranges: 1-5
 * - Steps: * /5, 1-10/2
 * - Lists: 1,3,5
 * - Day-of-week: 0-7 (0 and 7 are Sunday)
 *
 * Does NOT support:
 * - Named months/days (JAN, MON)
 * - @yearly, @monthly, etc. macros
 * - Seconds field (6-field cron)
 */

interface CronFields {
	minutes: Set<number>;
	hours: Set<number>;
	daysOfMonth: Set<number>;
	months: Set<number>;
	daysOfWeek: Set<number>;
	/** True when both day-of-month and day-of-week are restricted (not *). Per Vixie cron, uses OR. */
	bothDaysRestricted: boolean;
}

/**
 * Parse a single cron field into a set of matching values.
 */
function parseField(field: string, min: number, max: number): Set<number> {
	const values = new Set<number>();

	for (const part of field.split(',')) {
		const trimmed = part.trim();

		// Handle step values: */5 or 1-10/2
		const stepMatch = trimmed.match(/^(.+)\/(\d+)$/);
		if (stepMatch) {
			const range = stepMatch[1] ?? '*';
			const stepStr = stepMatch[2] ?? '1';
			const step = parseInt(stepStr, 10);
			if (step <= 0 || isNaN(step)) {
				throw new Error(`Invalid step value: ${stepStr}`);
			}

			let start = min;
			let end = max;

			if (range !== '*') {
				const rangeParts = range.split('-');
				if (rangeParts.length === 2) {
					start = parseInt(rangeParts[0] ?? '0', 10);
					end = parseInt(rangeParts[1] ?? '0', 10);
				} else if (rangeParts.length === 1) {
					start = parseInt(rangeParts[0] ?? '0', 10);
				}
			}

			for (let i = start; i <= end; i += step) {
				values.add(i);
			}
			continue;
		}

		// Handle wildcard
		if (trimmed === '*') {
			for (let i = min; i <= max; i++) {
				values.add(i);
			}
			continue;
		}

		// Handle range: 1-5
		const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
		if (rangeMatch) {
			const start = parseInt(rangeMatch[1] ?? '0', 10);
			const end = parseInt(rangeMatch[2] ?? '0', 10);
			for (let i = start; i <= end; i++) {
				values.add(i);
			}
			continue;
		}

		// Handle single value
		const value = parseInt(trimmed, 10);
		if (isNaN(value)) {
			throw new Error(`Invalid cron field value: ${trimmed}`);
		}
		values.add(value);
	}

	return values;
}

/**
 * Parse a 5-field cron expression into structured fields.
 */
function parseCron(expression: string): CronFields {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) {
		throw new Error(
			`Invalid cron expression: expected 5 fields (minute hour day-of-month month day-of-week), got ${parts.length}`,
		);
	}

	const domField = parts[2] ?? '*';
	const dowField = parts[4] ?? '*';

	const daysOfWeek = parseField(dowField, 0, 7);
	// Normalize Sunday: both 0 and 7 mean Sunday
	if (daysOfWeek.has(7)) {
		daysOfWeek.add(0);
		daysOfWeek.delete(7);
	}

	// Per Vixie cron: when BOTH day-of-month and day-of-week are restricted,
	// a date matches if EITHER field matches (OR). When only one is restricted,
	// only the restricted field matters (effectively AND since * matches all).
	const bothDaysRestricted = domField.trim() !== '*' && dowField.trim() !== '*';

	return {
		minutes: parseField(parts[0] ?? '*', 0, 59),
		hours: parseField(parts[1] ?? '*', 0, 23),
		daysOfMonth: parseField(domField, 1, 31),
		months: parseField(parts[3] ?? '*', 1, 12),
		daysOfWeek,
		bothDaysRestricted,
	};
}

/**
 * Check if a date matches a parsed cron expression (UTC).
 */
function matchesCron(date: Date, fields: CronFields): boolean {
	const domOk = fields.daysOfMonth.has(date.getUTCDate());
	const dowOk = fields.daysOfWeek.has(date.getUTCDay());
	const dayMatch = fields.bothDaysRestricted ? domOk || dowOk : domOk && dowOk;

	return (
		fields.minutes.has(date.getUTCMinutes()) &&
		fields.hours.has(date.getUTCHours()) &&
		dayMatch &&
		fields.months.has(date.getUTCMonth() + 1)
	);
}

/**
 * Calculate the next date/time that matches the given cron expression,
 * starting from the reference date (exclusive).
 *
 * @param expression - 5-field cron expression
 * @param from - Reference date (the search starts from the next minute)
 * @returns The next matching Date
 * @throws Error if expression is invalid or no match found within 4 years
 */
export function getNextCronDate(expression: string, from: Date = new Date()): Date {
	const fields = parseCron(expression);

	// Start from the next minute, with seconds/ms zeroed (UTC)
	const next = new Date(from.getTime());
	next.setUTCSeconds(0, 0);
	next.setUTCMinutes(next.getUTCMinutes() + 1);

	// Search limit: 4 years (enough for any valid cron expression)
	const maxDate = new Date(from.getTime() + 4 * 365 * 24 * 60 * 60 * 1000);

	while (next <= maxDate) {
		if (matchesCron(next, fields)) {
			return next;
		}

		// Optimize: skip ahead when month doesn't match
		if (!fields.months.has(next.getUTCMonth() + 1)) {
			next.setUTCMonth(next.getUTCMonth() + 1, 1);
			next.setUTCHours(0, 0, 0, 0);
			continue;
		}

		// Optimize: skip ahead when day doesn't match
		const domOk = fields.daysOfMonth.has(next.getUTCDate());
		const dowOk = fields.daysOfWeek.has(next.getUTCDay());
		const dayMatch = fields.bothDaysRestricted ? domOk || dowOk : domOk && dowOk;
		if (!dayMatch) {
			next.setUTCDate(next.getUTCDate() + 1);
			next.setUTCHours(0, 0, 0, 0);
			continue;
		}

		// Optimize: skip ahead when hour doesn't match
		if (!fields.hours.has(next.getUTCHours())) {
			next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
			continue;
		}

		// Advance by one minute
		next.setUTCMinutes(next.getUTCMinutes() + 1);
	}

	throw new Error(
		`No matching date found for cron expression "${expression}" within 4 years of ${from.toISOString()}`,
	);
}

/**
 * Validate a cron expression without computing next dates.
 *
 * @param expression - 5-field cron expression
 * @returns True if valid
 */
export function isValidCronExpression(expression: string): boolean {
	try {
		parseCron(expression);
		return true;
	} catch {
		return false;
	}
}
