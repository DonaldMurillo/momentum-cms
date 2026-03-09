import { createWorkerFixture } from '@momentumcms/e2e-fixtures';
import * as path from 'node:path';
import { getFlavorConfig } from './worker-config';

const flavorConfig = getFlavorConfig();

const PROJECT_DIR = process.env['E2E_PROJECT_DIR']
	? path.resolve(process.env['E2E_PROJECT_DIR'])
	: path.resolve(__dirname, '..', '..', '..', '..');
const WORKSPACE_ROOT = process.env['E2E_WORKSPACE_ROOT']
	? path.resolve(process.env['E2E_WORKSPACE_ROOT'])
	: PROJECT_DIR;

export const test = createWorkerFixture({
	appName: flavorConfig.appName,
	serverBinary: flavorConfig.serverBinary,
	healthEndpoint: flavorConfig.healthEndpoint,
	waitForSeeds: flavorConfig.waitForSeeds,
	projectDir: PROJECT_DIR,
	workspaceRoot: WORKSPACE_ROOT,
	smtpEnv: true,
});

export { expect } from '@playwright/test';
