import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import {
	UnauthorizedException,
	BadRequestException,
	ForbiddenException,
	NotFoundException as NestNotFoundException,
} from '@nestjs/common';
import { MomentumExceptionFilter } from './momentum-exception.filter';
import {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	GlobalNotFoundError,
	ReferentialIntegrityError,
	MomentumValidationError,
} from '@momentumcms/server-core';

function createMockHost() {
	const json = vi.fn();
	const status = vi.fn().mockReturnValue({ json });
	const response = { status };
	const request = {};

	return {
		switchToHttp: () => ({
			getResponse: () => response,
			getRequest: () => request,
		}),
		response,
		status,
		json,
	};
}

describe('MomentumExceptionFilter', () => {
	const filter = new MomentumExceptionFilter();

	it('should map CollectionNotFoundError to 404', () => {
		const host = createMockHost();
		filter.catch(new CollectionNotFoundError('posts'), host as never);
		expect(host.status).toHaveBeenCalledWith(404);
		expect(host.json).toHaveBeenCalledWith(
			expect.objectContaining({ error: expect.stringContaining('posts') }),
		);
	});

	it('should map DocumentNotFoundError to 404', () => {
		const host = createMockHost();
		filter.catch(new DocumentNotFoundError('posts', 'abc'), host as never);
		expect(host.status).toHaveBeenCalledWith(404);
	});

	it('should map GlobalNotFoundError to 404', () => {
		const host = createMockHost();
		filter.catch(new GlobalNotFoundError('settings'), host as never);
		expect(host.status).toHaveBeenCalledWith(404);
	});

	it('should map AccessDeniedError to 403', () => {
		const host = createMockHost();
		filter.catch(new AccessDeniedError('read', 'posts'), host as never);
		expect(host.status).toHaveBeenCalledWith(403);
	});

	it('should map ReferentialIntegrityError to 409', () => {
		const host = createMockHost();
		filter.catch(new ReferentialIntegrityError('Cannot delete'), host as never);
		expect(host.status).toHaveBeenCalledWith(409);
	});

	it('should map ValidationError to 400 with field errors', () => {
		const host = createMockHost();
		const error = new MomentumValidationError([{ field: 'title', message: 'Required' }]);
		filter.catch(error, host as never);
		expect(host.status).toHaveBeenCalledWith(400);
		expect(host.json).toHaveBeenCalledWith(
			expect.objectContaining({
				errors: [{ field: 'title', message: 'Required' }],
			}),
		);
	});

	it('should map unknown errors to 500 with sanitized message', () => {
		const host = createMockHost();
		filter.catch(new Error('some internal secret'), host as never);
		expect(host.status).toHaveBeenCalledWith(500);
		expect(host.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
	});

	it('should map NestJS UnauthorizedException to 401', () => {
		const host = createMockHost();
		filter.catch(new UnauthorizedException('Auth required'), host as never);
		expect(host.status).toHaveBeenCalledWith(401);
		expect(host.json).toHaveBeenCalledWith(
			expect.objectContaining({ error: expect.stringContaining('Auth required') }),
		);
	});

	it('should map NestJS BadRequestException to 400', () => {
		const host = createMockHost();
		filter.catch(new BadRequestException('Invalid input'), host as never);
		expect(host.status).toHaveBeenCalledWith(400);
		expect(host.json).toHaveBeenCalledWith(
			expect.objectContaining({ error: expect.stringContaining('Invalid input') }),
		);
	});

	it('should map NestJS ForbiddenException to 403', () => {
		const host = createMockHost();
		filter.catch(new ForbiddenException('Forbidden'), host as never);
		expect(host.status).toHaveBeenCalledWith(403);
	});

	it('should map NestJS NotFoundException to 404', () => {
		const host = createMockHost();
		filter.catch(new NestNotFoundException('Not found'), host as never);
		expect(host.status).toHaveBeenCalledWith(404);
	});
});
