/**
 * In-memory session store for demo/E2E testing.
 * In production, use a proper session store (Redis, database, etc.)
 */
export const sessions = new Map<string, { userId: string; email: string; role: string }>();
