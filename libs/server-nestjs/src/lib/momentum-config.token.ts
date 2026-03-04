import type { MomentumConfig } from '@momentumcms/core';

/**
 * Injection token for the Momentum CMS configuration.
 * Used with MomentumModule.forRoot(config) to provide config via DI.
 */
export const MOMENTUM_CONFIG = 'MOMENTUM_CONFIG' as const;

/**
 * Injection token for the optional API key store.
 * When null (default), ApiKeyGuard passes through all requests.
 */
export const API_KEY_STORE = 'API_KEY_STORE' as const;

export type MomentumConfigToken = MomentumConfig;
