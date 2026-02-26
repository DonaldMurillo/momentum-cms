# Momentum CMS - Project Memory

## Key Patterns

### Angular JIT + Signal Inputs

Angular JIT compiler does NOT support signal inputs (`input()`, `input.required()`). Components rendered via `renderApplication` with JIT (like email components) MUST use `@Input()` decorators. The email lib has an eslint override for this.

### Email Lib Architecture

- `libs/email` (env:server, esbuild) — Core email primitives, `renderEmail()`, `renderEmailFromBlocks()`, block types
- `libs/email-builder` (env:browser, ng-packagr) — Visual drag-drop builder
- Auth email components use dynamic imports in `email-templates.ts` to avoid loading Angular decorators at generator eval time

### ng-packagr Resolution

ng-packagr resolves dependencies from `dist/` output, NOT tsconfig path aliases. Sub-path imports like `@momentumcms/email/types` don't work because esbuild puts `.d.ts` files in `src/` subdirectory. Use main entry imports instead.

### Nitro Alias Config

Example-analog's Nitro requires explicit aliases for workspace packages in `vite.config.ts`. If adding a new lib that auth depends on, add it to the Nitro alias map.

### Module Boundary: allow list

`@momentumcms/email` is in the eslint `allow` list for module boundaries since email-builder (env:browser) imports types from it (env:server), and those are erased at compile time.

## Pre-existing Lint Failures

- `plugins-analytics:lint` — missing dependency declarations
- `server-analog:lint` — missing peerDependency declarations
