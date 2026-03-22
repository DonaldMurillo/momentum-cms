# @momentumcms/core

Collection config, fields, hooks, access control, and code generation for Momentum CMS.

## Building

Run `nx build core` to build the library.

## Code Generation

The generator reads `momentum.config.ts` and produces:

| Flag       | Default Output                     | Description                                           |
| ---------- | ---------------------------------- | ----------------------------------------------------- |
| `--types`  | `src/generated/momentum.types.ts`  | TypeScript interfaces for all collections and globals |
| `--config` | `src/generated/momentum.config.ts` | Browser-safe Angular admin config with inlined fields |
| `--client` | _(optional, no default)_           | Framework-agnostic fetch-based API client             |

```bash
npx tsx libs/core/src/generators/generator.ts src/momentum.config.ts \
  --types src/generated/momentum.types.ts \
  --config src/generated/momentum.config.ts \
  --client src/generated/momentum.client.ts
```

### Generator Architecture

The generator is decomposed into focused modules:

- **`generator.ts`** — CLI runner and re-exports
- **`generate-types.ts`** — TypeScript interface generation
- **`generate-client.ts`** — Fetch-based client SDK generation
- **`generate-admin-config.ts`** — Browser-safe admin config generation
- **`serialization.ts`** — Value/field/collection serialization to code strings
- **`field-to-typescript.ts`** — Field type to TypeScript type mapping
- **`generator-types.ts`** — Shared types, config loading, and utilities

## Running unit tests

Run `nx test core` to execute the unit tests via [Vitest](https://vitest.dev).
