#!/usr/bin/env node
import { runCLI } from './cli';

runCLI().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
