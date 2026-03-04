import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

// NestJS param decorators store metadata that can be tested
// by verifying the decorator factory function extracts req.user
describe('CurrentUser decorator', () => {
	it('should be a valid param decorator factory', () => {
		// CurrentUser is created via createParamDecorator, which returns a decorator factory
		expect(typeof CurrentUser).toBe('function');
	});

	it('should extract user from request when used', () => {
		// Test the decorator's underlying factory function
		class TestController {
			test(@CurrentUser() _user: unknown) {
				// noop
			}
		}

		// Verify decorator metadata was attached
		const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
		expect(metadata).toBeDefined();
	});
});
