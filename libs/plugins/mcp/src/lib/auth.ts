/**
 * Auth helpers for MCP plugin.
 *
 * Extracts authenticated user from Express request. The transport layer
 * (see mcp-transport.ts) handles the 401 response directly because it
 * also needs to inspect the request before delegating to the MCP SDK.
 */

import type { Request } from 'express';
import type { UserContext } from '@momentumcms/core';

interface RequestWithUser extends Request {
	user?: Record<string, unknown>;
}

function isUserRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Extract authenticated user context from an Express request.
 * Returns null if no valid user is present.
 */
export function extractUserContext(req: Request): UserContext | null {
	const reqWithUser: RequestWithUser = req;
	const user = reqWithUser.user;
	if (!isUserRecord(user)) return null;
	const id = user['id'];
	if (typeof id !== 'string' || id.length === 0) return null;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- UserContext is a branded type from Better Auth; can't narrow to it via type guards
	return user as unknown as UserContext;
}
