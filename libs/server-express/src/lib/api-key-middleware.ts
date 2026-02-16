import type { Router, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';
import type { ApiKeyStore } from '@momentumcms/server-core';
import {
	generateApiKey,
	hashApiKey,
	getKeyPrefix,
	isValidApiKeyFormat,
	generateApiKeyId,
} from '@momentumcms/server-core';
import type { AuthenticatedRequest } from './auth-middleware';

/**
 * Configuration for API key middleware.
 */
export interface ApiKeyMiddlewareConfig {
	/** The API key store for database operations */
	store: ApiKeyStore;
}

/**
 * Creates middleware that resolves API key from X-API-Key header.
 *
 * If a valid API key is found, sets req.user with the key's role.
 * If no API key header is present, passes through (session auth may handle it).
 * If an invalid/expired key is provided, returns 401.
 *
 * Should be placed BEFORE session resolver middleware so both auth methods work.
 *
 * @example
 * ```typescript
 * app.use(createApiKeyResolverMiddleware({ store: apiKeyStore }));
 * app.use(createSessionResolverMiddleware(auth));
 * app.use('/api', momentumApiMiddleware(config));
 * ```
 */
export function createApiKeyResolverMiddleware(
	config: ApiKeyMiddlewareConfig,
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
		const apiKey = req.headers['x-api-key'];

		// No API key header - let session auth handle it
		if (!apiKey || typeof apiKey !== 'string') {
			next();
			return;
		}

		// Validate key format
		if (!isValidApiKeyFormat(apiKey)) {
			res.status(401).json({ error: 'Invalid API key format' });
			return;
		}

		try {
			const keyHash = hashApiKey(apiKey);
			const record = await config.store.findByHash(keyHash);

			if (!record) {
				res.status(401).json({ error: 'Invalid API key' });
				return;
			}

			// Check expiration
			if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
				res.status(401).json({ error: 'API key expired' });
				return;
			}

			// Set user context from API key
			req.user = {
				id: `apikey:${record.id}`,
				email: `apikey-${record.name}@system`,
				name: `API Key: ${record.name}`,
				role: record.role,
			};

			// Update last used (fire and forget)
			config.store.updateLastUsed(record.id, new Date().toISOString()).catch(() => {
				// Silently ignore - non-critical update
			});

			next();
		} catch {
			res.status(500).json({ error: 'API key validation failed' });
		}
	};
}

/** Role hierarchy for permission checks. Lower index = higher privilege.
 * Canonical source: AUTH_ROLES in @momentumcms/auth/collections */
const ROLE_HIERARCHY = ['admin', 'editor', 'user', 'viewer'];

/**
 * Creates Express router for API key management endpoints.
 *
 * All endpoints require authentication. Admin sees all keys, non-admin sees own.
 *
 * Endpoints:
 * - GET    /api-keys       - List API keys (admin: all, others: own)
 * - POST   /api-keys       - Create a new API key
 * - DELETE  /api-keys/:id   - Delete an API key (admin: any, others: own)
 *
 * @example
 * ```typescript
 * app.use('/api', createApiKeyRoutes({ store: apiKeyStore }));
 * ```
 */
export function createApiKeyRoutes(config: ApiKeyMiddlewareConfig): Router {
	const router = createRouter();

	// List API keys (admin sees all, others see own)
	router.get('/api-keys', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express request augmentation
		const user = req.user as { id: string; role?: string } | undefined;

		if (!user) {
			res.status(401).json({ error: 'Unauthorized' });
			return;
		}

		try {
			const keys =
				user.role === 'admin'
					? await config.store.listAll()
					: await config.store.listByUser(user.id);
			res.json({ keys });
		} catch {
			res.status(500).json({ error: 'Failed to list API keys' });
		}
	});

	// Create a new API key (any authenticated user)
	router.post('/api-keys', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express request augmentation
		const user = req.user as { id: string; role?: string } | undefined;

		if (!user) {
			res.status(401).json({ error: 'Unauthorized' });
			return;
		}

		// API keys cannot create other API keys — only session-authenticated users can
		if (typeof user.id === 'string' && user.id.startsWith('apikey:')) {
			res.status(403).json({ error: 'API keys cannot create other API keys' });
			return;
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Request body typing
		const body = req.body as { name?: string; role?: string; expiresAt?: string };

		if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
			res.status(400).json({ error: 'Name is required' });
			return;
		}

		const role = body.role ?? 'user';
		const validRoles = ['admin', 'editor', 'user', 'viewer'];
		if (!validRoles.includes(role)) {
			res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
			return;
		}

		// Non-admin users cannot create keys with a higher role than their own
		const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role ?? 'viewer');
		if (user.role !== 'admin' && userRoleIndex === -1) {
			res.status(403).json({ error: 'Unknown role — cannot determine privileges' });
			return;
		}
		const requestedRoleIndex = ROLE_HIERARCHY.indexOf(role);
		if (user.role !== 'admin' && requestedRoleIndex < userRoleIndex) {
			res
				.status(403)
				.json({ error: `Cannot create a key with higher privileges than your own role` });
			return;
		}

		// Validate expiresAt if provided — invalid dates bypass expiration checks
		let expiresAt: string | null = null;
		if (body.expiresAt != null) {
			const parsed = new Date(body.expiresAt);
			if (isNaN(parsed.getTime())) {
				res.status(400).json({ error: 'Invalid expiresAt date format. Use ISO 8601.' });
				return;
			}
			expiresAt = parsed.toISOString();
		}

		try {
			const key = generateApiKey();
			const id = generateApiKeyId();
			const now = new Date().toISOString();

			const createdId = await config.store.create({
				id,
				name: body.name.trim(),
				keyHash: hashApiKey(key),
				keyPrefix: getKeyPrefix(key),
				createdBy: user.id,
				role,
				expiresAt,
				createdAt: now,
				updatedAt: now,
			});

			// Return the full key only at creation time
			// Use createdId (adapter may generate its own ID)
			res.status(201).json({
				id: createdId,
				name: body.name.trim(),
				key,
				keyPrefix: getKeyPrefix(key),
				role,
				expiresAt,
				createdAt: now,
			});
		} catch {
			res.status(500).json({ error: 'Failed to create API key' });
		}
	});

	// Delete an API key (admin: any, others: own only)
	router.delete(
		'/api-keys/:id',
		async (req: AuthenticatedRequest, res: Response): Promise<void> => {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express request augmentation
			const user = req.user as { id: string; role?: string } | undefined;

			if (!user) {
				res.status(401).json({ error: 'Unauthorized' });
				return;
			}

			const keyId = req.params['id'];

			// Non-admin users can only delete their own keys
			if (user.role !== 'admin') {
				const existingKey = await config.store.findById(keyId);
				if (!existingKey) {
					res.status(404).json({ error: 'API key not found' });
					return;
				}
				if (existingKey.createdBy !== user.id) {
					res.status(403).json({ error: 'You can only delete your own API keys' });
					return;
				}
			}

			try {
				const deleted = await config.store.deleteById(keyId);
				if (deleted) {
					res.json({ deleted: true });
				} else {
					res.status(404).json({ error: 'API key not found' });
				}
			} catch {
				res.status(500).json({ error: 'Failed to delete API key' });
			}
		},
	);

	return router;
}
