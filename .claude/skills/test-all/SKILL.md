---
name: test-all
description: Run the full Momentum CMS test suite (unit tests, all E2E suites, migration tests, CLI scaffold). Use when asked to "test all", "run all tests", "test-all script", "run the full suite", or any variation. NEVER skip any suite unless the user explicitly asks.
argument-hint: [--suite <name>] [--skip <name>]
---

# Full Test Suite Runner

Runs **every** test suite in the Momentum CMS monorepo. **Do NOT skip any suite unless the user explicitly requests it.**

## Command

```bash
npm run test:all
```

This executes `npx tsx scripts/test-all.ts` which runs all suites sequentially.

## Available Suites

| Name                  | Label               | What It Runs                                        |
| --------------------- | ------------------- | --------------------------------------------------- |
| `unit-tests`          | Unit Tests          | `nx run-many -t test --parallel=3` (all unit tests) |
| `angular-e2e`         | Angular E2E         | `nx e2e example-angular-e2e`                        |
| `analog-e2e`          | Analog E2E          | `nx e2e example-analog-e2e`                         |
| `nestjs-e2e`          | NestJS E2E          | `nx e2e example-nestjs-e2e`                         |
| `swappable-admin-e2e` | Swappable Admin E2E | `nx e2e test-swappable-admin-e2e`                   |
| `migration-tests`     | Migration Tests     | `nx test migrations`                                |
| `cli-scaffold`        | CLI Scaffold Test   | `npx tsx scripts/test-all.ts --database sqlite`     |

## Usage

```bash
# Run EVERYTHING (default — this is what "test all" means)
npm run test:all

# Run only one suite
npm run test:all -- --suite angular-e2e

# Skip specific suites (only if user explicitly asks)
npm run test:all -- --skip cli-scaffold --skip analog-e2e
```

## Rules

1. **When the user says "test all", "run test all", "test-all script", or similar — run `npm run test:all` with NO --skip flags.** Every suite must run.
2. Logs go to `/tmp/test-all/`. If a suite fails, read the log file to diagnose.
3. The script exits with code 1 if any suite fails.
4. Timeout should be generous (10 minutes) since E2E suites take time.
5. If a suite fails, report which suite failed and show the last ~30 lines of its log.

## Arguments

- `$ARGUMENTS` — passed directly to the script (e.g., `--suite unit-tests`, `--skip cli-scaffold`). If empty, runs everything.

## Execution

```bash
npm run test:all $ARGUMENTS
```
