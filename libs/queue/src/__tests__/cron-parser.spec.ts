import { getNextCronDate, isValidCronExpression } from '../lib/cron-parser';

describe('cron-parser', () => {
	describe('isValidCronExpression', () => {
		it('should accept valid cron expressions', () => {
			expect(isValidCronExpression('* * * * *')).toBe(true);
			expect(isValidCronExpression('0 * * * *')).toBe(true);
			expect(isValidCronExpression('0 2 * * *')).toBe(true);
			expect(isValidCronExpression('*/5 * * * *')).toBe(true);
			expect(isValidCronExpression('0 9 * * 1')).toBe(true);
			expect(isValidCronExpression('0 0 1 * *')).toBe(true);
			expect(isValidCronExpression('30 4 1,15 * *')).toBe(true);
			expect(isValidCronExpression('0 0 * * 0-5')).toBe(true);
			expect(isValidCronExpression('0 0 * * 7')).toBe(true); // Sunday as 7
		});

		it('should reject invalid cron expressions', () => {
			expect(isValidCronExpression('')).toBe(false);
			expect(isValidCronExpression('* * *')).toBe(false); // too few fields
			expect(isValidCronExpression('* * * * * *')).toBe(false); // too many fields
			expect(isValidCronExpression('abc * * * *')).toBe(false);
		});
	});

	describe('getNextCronDate', () => {
		// Use a fixed reference date: 2025-06-15 10:30:00 (Sunday)
		const ref = new Date('2025-06-15T10:30:00.000Z');

		it('should find the next minute for "* * * * *"', () => {
			const next = getNextCronDate('* * * * *', ref);
			expect(next).toEqual(new Date('2025-06-15T10:31:00.000Z'));
		});

		it('should find the next hour for "0 * * * *"', () => {
			const next = getNextCronDate('0 * * * *', ref);
			expect(next).toEqual(new Date('2025-06-15T11:00:00.000Z'));
		});

		it('should find the next occurrence at 2 AM for "0 2 * * *"', () => {
			const next = getNextCronDate('0 2 * * *', ref);
			expect(next).toEqual(new Date('2025-06-16T02:00:00.000Z'));
		});

		it('should handle every-5-minutes step for "*/5 * * * *"', () => {
			const next = getNextCronDate('*/5 * * * *', ref);
			expect(next).toEqual(new Date('2025-06-15T10:35:00.000Z'));
		});

		it('should find next Monday for "0 9 * * 1"', () => {
			// ref is Sunday June 15, next Monday is June 16
			const next = getNextCronDate('0 9 * * 1', ref);
			expect(next).toEqual(new Date('2025-06-16T09:00:00.000Z'));
		});

		it('should find first of next month for "0 0 1 * *"', () => {
			const next = getNextCronDate('0 0 1 * *', ref);
			expect(next).toEqual(new Date('2025-07-01T00:00:00.000Z'));
		});

		it('should handle list values for "0 0 1,15 * *"', () => {
			// ref is June 15 10:30, next match is June 15 at midnight is past,
			// so July 1 at midnight
			const next = getNextCronDate('0 0 1,15 * *', ref);
			expect(next).toEqual(new Date('2025-07-01T00:00:00.000Z'));
		});

		it('should handle range for day of week "0 0 * * 1-5" (weekdays)', () => {
			// ref is Sunday June 15, next weekday is Monday June 16
			const next = getNextCronDate('0 0 * * 1-5', ref);
			expect(next).toEqual(new Date('2025-06-16T00:00:00.000Z'));
		});

		it('should normalize Sunday (7) to 0', () => {
			// ref is Sunday June 15, "0 0 * * 7" means Sunday
			// Next Sunday after June 15 is June 22
			const next = getNextCronDate('0 0 * * 7', ref);
			expect(next).toEqual(new Date('2025-06-22T00:00:00.000Z'));
		});

		it('should handle step with range "0 1-10/3 * * *"', () => {
			// Hours 1, 4, 7, 10 — ref is 10:30, so next is hour 1 tomorrow
			const next = getNextCronDate('0 1-10/3 * * *', ref);
			expect(next).toEqual(new Date('2025-06-16T01:00:00.000Z'));
		});

		it('should handle specific month "0 0 1 12 *" (December 1)', () => {
			const next = getNextCronDate('0 0 1 12 *', ref);
			expect(next).toEqual(new Date('2025-12-01T00:00:00.000Z'));
		});

		it('should skip to the correct minute within the same hour', () => {
			const refExact = new Date('2025-06-15T10:00:00.000Z');
			const next = getNextCronDate('30 10 * * *', refExact);
			expect(next).toEqual(new Date('2025-06-15T10:30:00.000Z'));
		});

		it('should throw for invalid expressions', () => {
			expect(() => getNextCronDate('invalid')).toThrow();
			expect(() => getNextCronDate('* * *')).toThrow();
		});

		describe('day-of-month + day-of-week OR semantics (Vixie cron spec)', () => {
			// When BOTH day-of-month and day-of-week are restricted (not *),
			// standard cron matches dates where EITHER field matches (OR logic).
			// ref = 2025-06-15 (Sunday)

			it('should match 15th OR Monday with "0 0 15 * 1"', () => {
				// Next Monday is June 16; June 15 is past (ref is 10:30)
				// With OR: June 16 (Monday) matches day-of-week
				// With AND (bug): would skip to a month where 15th is a Monday
				const next = getNextCronDate('0 0 15 * 1', ref);
				expect(next).toEqual(new Date('2025-06-16T00:00:00.000Z'));
			});

			it('should match 1st,15th OR Fridays with "0 12 1,15 * 5"', () => {
				// June 15 is day-of-month 15 (matches {1,15}) — OR fires on dom
				// ref is 10:30, so 12:00 on June 15 is still in the future
				const next = getNextCronDate('0 12 1,15 * 5', ref);
				expect(next).toEqual(new Date('2025-06-15T12:00:00.000Z'));
			});

			it('should still work when only day-of-month is restricted (dow is *)', () => {
				// No behavior change — effectively AND since * matches everything
				const next = getNextCronDate('0 0 20 * *', ref);
				expect(next).toEqual(new Date('2025-06-20T00:00:00.000Z'));
			});

			it('should still work when only day-of-week is restricted (dom is *)', () => {
				// No behavior change — effectively AND since * matches everything
				const next = getNextCronDate('0 0 * * 1', ref);
				expect(next).toEqual(new Date('2025-06-16T00:00:00.000Z'));
			});

			it('should match day-of-month on a non-matching day-of-week with "0 0 20 * 1"', () => {
				// June 20 2025 is a Friday (day-of-week 5, not 1/Monday)
				// With OR: June 20 matches day-of-month, June 16 matches day-of-week
				// June 16 comes first
				const next = getNextCronDate('0 0 20 * 1', ref);
				expect(next).toEqual(new Date('2025-06-16T00:00:00.000Z'));
			});
		});
	});
});
