/**
 * Type-safe route data utilities
 */

import type { CollectionConfig, GlobalConfig } from '@momentum-cms/core';
import type { MomentumAdminBranding, AdminPluginRoute } from '../routes/momentum-admin-routes';
import type { Data } from '@angular/router';

/**
 * Type guard to check if an object is a CollectionConfig
 */
function isCollectionConfig(obj: unknown): obj is CollectionConfig {
	if (typeof obj !== 'object' || obj === null) return false;
	// Use property access with type narrowing
	const hasSlug = 'slug' in obj && typeof obj.slug === 'string';
	const hasFields = 'fields' in obj && Array.isArray(obj.fields);
	return hasSlug && hasFields;
}

/**
 * Type guard to check if an array contains CollectionConfig objects
 */
function isCollectionConfigArray(arr: unknown): arr is CollectionConfig[] {
	return Array.isArray(arr) && arr.every(isCollectionConfig);
}

/**
 * Type guard to check if an object is MomentumAdminBranding
 */
function isBranding(obj: unknown): obj is MomentumAdminBranding {
	if (typeof obj !== 'object' || obj === null) return false;
	// Branding is optional, so we just check if the known properties have correct types
	if ('logo' in obj && typeof obj.logo !== 'string') return false;
	if ('title' in obj && typeof obj.title !== 'string') return false;
	return true;
}

/**
 * Extracts collections from route data with type safety
 */
export function getCollectionsFromRouteData(data: Data | undefined): CollectionConfig[] {
	if (!data) return [];
	const collections = data['collections'];
	if (isCollectionConfigArray(collections)) {
		return collections;
	}
	return [];
}

/**
 * Extracts branding from route data with type safety
 */
export function getBrandingFromRouteData(
	data: Data | undefined,
): MomentumAdminBranding | undefined {
	if (!data) return undefined;
	const branding = data['branding'];
	if (branding === undefined || branding === null) return undefined;
	if (isBranding(branding)) {
		return branding;
	}
	return undefined;
}

/**
 * Extracts globals from route data with type safety
 */
export function getGlobalsFromRouteData(data: Data | undefined): GlobalConfig[] {
	if (!data) return [];
	const globals = data['globals'];
	if (Array.isArray(globals)) {
		// Same shape check as collections — slug + fields
		return globals.filter(
			(g) => typeof g === 'object' && g !== null && 'slug' in g && 'fields' in g,
		);
	}
	return [];
}

/**
 * Extracts plugin routes from route data
 */
export function getPluginRoutesFromRouteData(data: Data | undefined): AdminPluginRoute[] {
	if (!data) return [];
	const routes = data['pluginRoutes'];
	if (Array.isArray(routes)) {
		return routes;
	}
	return [];
}
