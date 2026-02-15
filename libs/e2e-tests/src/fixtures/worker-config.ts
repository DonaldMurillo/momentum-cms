import { type TestUserCredentials } from '@momentum-cms/e2e-fixtures';
import {
	TEST_ADMIN,
	TEST_EDITOR,
	TEST_VIEWER,
	TEST_AUTHOR_1,
	TEST_AUTHOR_2,
	TEST_AUTHOR_3,
	ADDITIONAL_TEST_USERS,
} from '@momentum-cms/example-config';

/**
 * Worker server configuration resolved from E2E_SERVER_FLAVOR.
 * Both flavors use the same collections, seeding, and test users
 * from @momentum-cms/example-config.
 */

export const TEST_CREDENTIALS: TestUserCredentials = TEST_ADMIN;
export const TEST_EDITOR_CREDENTIALS: TestUserCredentials = TEST_EDITOR;
export const TEST_VIEWER_CREDENTIALS: TestUserCredentials = TEST_VIEWER;
export const TEST_AUTHOR1_CREDENTIALS: TestUserCredentials = TEST_AUTHOR_1;
export const TEST_AUTHOR2_CREDENTIALS: TestUserCredentials = TEST_AUTHOR_2;
export const TEST_AUTHOR3_CREDENTIALS: TestUserCredentials = TEST_AUTHOR_3;

export { ADDITIONAL_TEST_USERS };

interface FlavorConfig {
	appName: string;
	serverBinary: string;
	healthEndpoint: string;
	waitForSeeds: boolean;
	buildCommand: string;
}

const flavorConfigs: Record<string, FlavorConfig> = {
	angular: {
		appName: 'angular',
		serverBinary: 'dist/apps/example-angular/server/server.mjs',
		healthEndpoint: '/api/health?checkSeeds=true',
		waitForSeeds: true,
		buildCommand: 'nx build example-angular',
	},
	analog: {
		appName: 'analog',
		serverBinary: 'dist/apps/example-analog/analog/server/index.mjs',
		healthEndpoint: '/api/health?checkSeeds=true',
		waitForSeeds: true,
		buildCommand: 'nx build example-analog',
	},
};

/**
 * Get the server flavor from environment variable.
 * Defaults to 'angular' if not set.
 */
export function getServerFlavor(): string {
	return process.env['E2E_SERVER_FLAVOR'] ?? 'angular';
}

/**
 * Get the flavor-specific configuration.
 */
export function getFlavorConfig(): FlavorConfig {
	const flavor = getServerFlavor();
	const config = flavorConfigs[flavor];
	if (!config) {
		throw new Error(
			`Unknown E2E_SERVER_FLAVOR: "${flavor}". Valid values: ${Object.keys(flavorConfigs).join(', ')}`,
		);
	}
	return config;
}
