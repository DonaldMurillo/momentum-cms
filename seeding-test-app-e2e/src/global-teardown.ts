import { stopMailpit } from '@momentum-cms/e2e-fixtures';

/**
 * Global teardown — runs once after all workers finish.
 * Stops Mailpit if it was started by global setup.
 */
async function globalTeardown(): Promise<void> {
	await stopMailpit();
}

export default globalTeardown;
