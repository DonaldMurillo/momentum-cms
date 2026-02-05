import { defineEventHandler, readBody, setCookie } from 'h3';
import { randomUUID } from 'crypto';
import { initializeMomentumAPI, getMomentumAPI } from '@momentum-cms/server-core';
import momentumConfig from '../../../../../momentum.config';
import { sessions } from '../../../../utils/sessions';

// Initialize Momentum API on first request
let initialized = false;

/**
 * POST /api/auth/sign-in/email
 * Authenticate a user with email and password.
 */
export default defineEventHandler(async (event) => {
	// Initialize Momentum API if not already done
	if (!initialized) {
		await momentumConfig.db.adapter.initialize?.(momentumConfig.collections);
		initializeMomentumAPI(momentumConfig);
		initialized = true;
	}

	const body = await readBody(event);
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- h3 readBody returns unknown
	const { email, password } = body as { email: string; password: string };

	if (!email || !password) {
		return {
			error: { message: 'Email and password are required' },
		};
	}

	// For demo purposes, accept 'password123' as password
	// In production, this would verify against a real auth system
	if (password !== 'password123') {
		return {
			error: { message: 'Invalid email or password' },
		};
	}

	const api = getMomentumAPI();

	// Use system context to find user
	const systemApi = api.setContext({
		user: { id: 'system', email: 'system@localhost', role: 'admin' },
	});

	try {
		const usersCollection = systemApi.collection('users');
		const result = await usersCollection.find({ limit: 1000 });
		const user = result.docs.find((u: { email: string }) => u.email === email);

		if (!user) {
			return {
				error: { message: 'Invalid email or password' },
			};
		}

		// Create session
		const sessionId = randomUUID();
		sessions.set(sessionId, {
			userId: String(user.id),
			email: String(user.email),
			role: String(user.role || 'viewer'),
		});

		// Set session cookie
		setCookie(event, 'momentum_session', sessionId, {
			httpOnly: true,
			secure: process.env['NODE_ENV'] === 'production',
			sameSite: 'lax',
			path: '/',
			maxAge: 60 * 60 * 24 * 7, // 7 days
		});

		return {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
		};
	} catch (error) {
		console.error('[Auth] Sign-in error:', error);
		return {
			error: { message: 'Authentication failed' },
		};
	}
});
