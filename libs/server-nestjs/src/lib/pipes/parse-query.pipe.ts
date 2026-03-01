import { Injectable, type PipeTransform } from '@nestjs/common';
import type { QueryOptions } from '@momentumcms/server-core';

/**
 * Pipe that transforms raw query string parameters into a typed QueryOptions object.
 * Handles parsing limit/page/depth as numbers, sort as string, and where as JSON.
 */
@Injectable()
export class ParseQueryPipe implements PipeTransform<Record<string, string>, QueryOptions> {
	transform(value: Record<string, string>): QueryOptions {
		const result: QueryOptions = {};

		if (value['limit']) {
			const n = parseInt(value['limit'], 10);
			if (!isNaN(n)) result.limit = n;
		}

		if (value['page']) {
			const n = parseInt(value['page'], 10);
			if (!isNaN(n)) result.page = n;
		}

		if (value['depth']) {
			const n = parseInt(value['depth'], 10);
			if (!isNaN(n)) result['depth'] = n;
		}

		if (value['sort']) {
			result.sort = value['sort'];
		}

		if (value['where']) {
			try {
				result.where = JSON.parse(value['where']);
			} catch {
				// Invalid JSON — ignore
			}
		}

		if (value['withDeleted']) {
			result['withDeleted'] = value['withDeleted'] === 'true';
		}

		if (value['onlyDeleted']) {
			result['onlyDeleted'] = value['onlyDeleted'] === 'true';
		}

		return result;
	}
}
