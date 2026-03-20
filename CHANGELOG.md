## 0.5.11 (2026-03-20)

### 🩹 Fixes

- system field validation, CORS wildcard, localStorage tests & API key enumeration ([228d4a1e](https://github.com/DonaldMurillo/momentum-cms/commit/228d4a1e))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.10 (2026-03-13)

### 🚀 Features

- headless theme editor with CSS injection protection, validation, sidebar icons & E2E ([1fd7fb2d](https://github.com/DonaldMurillo/momentum-cms/commit/1fd7fb2d))
- centralize admin icon provider — all heroicons available by default ([39a21e2c](https://github.com/DonaldMurillo/momentum-cms/commit/39a21e2c))

### 🩹 Fixes

- register missing plugin sidebar icons + update skills with icon checklist ([28e45b4b](https://github.com/DonaldMurillo/momentum-cms/commit/28e45b4b))
- verify clipboard contents in E2E test and trace hardcoded values to source ([a28e9868](https://github.com/DonaldMurillo/momentum-cms/commit/a28e9868))
- E2E stability, shadow token wiring, and email template access control ([d4bc2068](https://github.com/DonaldMurillo/momentum-cms/commit/d4bc2068))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.9 (2026-03-10)

### 🚀 Features

- PostgreSQL cloneDatabase/dropClone, plugin docs, E2E fix, stroll-test UI packages ([1de374ce](https://github.com/DonaldMurillo/momentum-cms/commit/1de374ce))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.8 (2026-03-10)

### 🚀 Features

- add stroll-test skill for CLI published package validation ([6041e56f](https://github.com/DonaldMurillo/momentum-cms/commit/6041e56f))
- add MemoryQueueAdapter for queue and cron plugin testing ([cc0867e2](https://github.com/DonaldMurillo/momentum-cms/commit/cc0867e2))

### 🩹 Fixes

- form-builder release config missing source manifestRoot ([756e1633](https://github.com/DonaldMurillo/momentum-cms/commit/756e1633))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.7 (2026-03-10)

### 🩹 Fixes

- migration mode fixes, first-user admin, and overrideAccess bypass ([bf164074](https://github.com/DonaldMurillo/momentum-cms/commit/bf164074))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.6 (2026-03-10)

### 🩹 Fixes

- migration schematics, db adapter raw queries, and plugin admin-routes d.ts ([2fd189a6](https://github.com/DonaldMurillo/momentum-cms/commit/2fd189a6))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.5 (2026-03-09)

### 🚀 Features

- Initialize Momentum CMS foundation ([f64f5817](https://github.com/DonaldMurillo/momentum-cms/commit/f64f5817))
- Implement admin UI with API integration and SSR hydration ([9ed7b2bd](https://github.com/DonaldMurillo/momentum-cms/commit/9ed7b2bd))
- Add Tailwind design system and fix SQLite reliability ([6dd79b11](https://github.com/DonaldMurillo/momentum-cms/commit/6dd79b11))
- Add authentication, UI library, and theme system ([0d387205](https://github.com/DonaldMurillo/momentum-cms/commit/0d387205))
- Add type-safe Momentum API with signal support ([aee6c029](https://github.com/DonaldMurillo/momentum-cms/commit/aee6c029))
- Add TransferState support for SSR hydration ([9563cdb8](https://github.com/DonaldMurillo/momentum-cms/commit/9563cdb8))
- Add role-based access control system ([ebadbbef](https://github.com/DonaldMurillo/momentum-cms/commit/ebadbbef))
- Add typed access control helper functions ([980d8d0a](https://github.com/DonaldMurillo/momentum-cms/commit/980d8d0a))
- Add Claude code quality and accessibility hooks ([be3c3d1d](https://github.com/DonaldMurillo/momentum-cms/commit/be3c3d1d))
- Add seeding feature with idempotent data initialization ([#1](https://github.com/DonaldMurillo/momentum-cms/pull/1))
- migrate landing page to Momentum CMS UI components ([#3](https://github.com/DonaldMurillo/momentum-cms/pull/3))
- Add document versioning and drafts system ([#5](https://github.com/DonaldMurillo/momentum-cms/pull/5))
- add password reset flow with E2E tests ([#6](https://github.com/DonaldMurillo/momentum-cms/pull/6))
- UI polish fixes and database-level FK constraints for relationship integrity ([#13](https://github.com/DonaldMurillo/momentum-cms/pull/13))
- Add display formatting and complex field rendering ([#14](https://github.com/DonaldMurillo/momentum-cms/pull/14))
- visual block editor & auth-gated admin mode ([#18](https://github.com/DonaldMurillo/momentum-cms/pull/18))
- implement globals (singleton collections) with full stack support ([#20](https://github.com/DonaldMurillo/momentum-cms/pull/20))
- add tracking rules, content performance, and block analytics ([#21](https://github.com/DonaldMurillo/momentum-cms/pull/21))
- implement soft deletes with full stack support ([#22](https://github.com/DonaldMurillo/momentum-cms/pull/22))
- add named tabs support with nested data grouping and UI improvements ([#30](https://github.com/DonaldMurillo/momentum-cms/pull/30))
- add SEO plugin ([#33](https://github.com/DonaldMurillo/momentum-cms/pull/33))
- implement Payload-style migration CLI workflow with clone-test-apply safety ([#35](https://github.com/DonaldMurillo/momentum-cms/pull/35))
- blocks showcase with articles, pages, and UI fixes ([#36](https://github.com/DonaldMurillo/momentum-cms/pull/36))
- SEO plugin recovery, E2E fixes, and CLI templates ([#37](https://github.com/DonaldMurillo/momentum-cms/pull/37), [#33](https://github.com/DonaldMurillo/momentum-cms/issues/33))
- client-side page view tracking and content performance improvements ([#39](https://github.com/DonaldMurillo/momentum-cms/pull/39))
- S3, auth plugin wiring, redirects, and E2E tooling ([#41](https://github.com/DonaldMurillo/momentum-cms/pull/41))
- NestJS server adapter + E2E stabilization (0.5.2) ([#48](https://github.com/DonaldMurillo/momentum-cms/pull/48))
- Versioning & drafts with draft/publish workflow ([#50](https://github.com/DonaldMurillo/momentum-cms/pull/50))
- swappable admin pages & layout slots with security hardening ([#51](https://github.com/DonaldMurillo/momentum-cms/pull/51))
- extract syncDatabaseSchema + fix findById breaking change ([#52](https://github.com/DonaldMurillo/momentum-cms/pull/52))
- OpenTelemetry observability plugin with metrics, Prometheus, and dashboard ([#53](https://github.com/DonaldMurillo/momentum-cms/pull/53))
- **ui:** enhance command palette with autofocus, filtering, and keyboard nav ([#2](https://github.com/DonaldMurillo/momentum-cms/pull/2))

### 🩹 Fixes

- address security and reliability issues from code review ([#7](https://github.com/DonaldMurillo/momentum-cms/pull/7))
- address security vulnerabilities from code review ([#9](https://github.com/DonaldMurillo/momentum-cms/pull/9))
- address 7 critical and high-severity security and validation bugs ([#12](https://github.com/DonaldMurillo/momentum-cms/pull/12))
- resolve CUD toast interceptor issues ([#17](https://github.com/DonaldMurillo/momentum-cms/pull/17), [#1](https://github.com/DonaldMurillo/momentum-cms/issues/1), [#2](https://github.com/DonaldMurillo/momentum-cms/issues/2), [#3](https://github.com/DonaldMurillo/momentum-cms/issues/3), [#4](https://github.com/DonaldMurillo/momentum-cms/issues/4))
- correct repository URLs and add GitHub link to CLI ([#26](https://github.com/DonaldMurillo/momentum-cms/pull/26))
- add safe HTML id generation for collection groups with spaces in names ([#31](https://github.com/DonaldMurillo/momentum-cms/pull/31))
- add safe HTML id generation for collection groups with spaces in names ([#31](https://github.com/DonaldMurillo/momentum-cms/pull/31))
- add auth guard and MIME validation to PATCH upload route; fix pagination with client-side filtering ([#32](https://github.com/DonaldMurillo/momentum-cms/pull/32))
- fix nav highlighting and resolve pre-existing E2E test failures ([#34](https://github.com/DonaldMurillo/momentum-cms/pull/34))
- Resolve non-null assertion bugs and CLAUDE.md violations ([#44](https://github.com/DonaldMurillo/momentum-cms/pull/44))
- queue feature code review issues ([#45](https://github.com/DonaldMurillo/momentum-cms/pull/45))
- add public access to form-builder npm publish config ([#46](https://github.com/DonaldMurillo/momentum-cms/pull/46))
- Analog versioning access control + E2E improvements ([#54](https://github.com/DonaldMurillo/momentum-cms/pull/54))
- **a11y:** resolve E2E, focus indicator, and error sanitization issues ([#19](https://github.com/DonaldMurillo/momentum-cms/pull/19))
- **admin:** resolve entity sheet issues ([#16](https://github.com/DonaldMurillo/momentum-cms/pull/16))
- **create-momentum-app:** add shell option to execFileSync for Windows ([#28](https://github.com/DonaldMurillo/momentum-cms/pull/28))

### ❤️ Thank You

- Claude Haiku 4.5
- Claude Opus 4.5
- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.4 (2026-03-07)

### 🚀 Features

- swappable admin pages & layout slots with config-driven code generation ([425b4199](https://github.com/DonaldMurillo/momentum-cms/commit/425b4199))
- Versioning & drafts with draft/publish workflow ([#50](https://github.com/DonaldMurillo/momentum-cms/pull/50))

### 🩹 Fixes

- remove unused test target from test-swappable-admin ([a256cb24](https://github.com/DonaldMurillo/momentum-cms/commit/a256cb24))
- race conditions, code injection, and test quality in swappable admin ([eaa9dcec](https://github.com/DonaldMurillo/momentum-cms/commit/eaa9dcec))

### ❤️ Thank You

- Claude Haiku 4.5
- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.0 (2026-02-23)

This was a version bump only, there were no code changes.

## 0.4.1 (2026-02-22)

### 🚀 Features

- **analytics:** add client-side SPA page view tracking with content attribution ([f2bbe1c](https://github.com/DonaldMurillo/momentum-cms/commit/f2bbe1c))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.4.0 (2026-02-22)

### 🚀 Features

- blocks showcase with articles, pages, and UI fixes ([#36](https://github.com/DonaldMurillo/momentum-cms/pull/36))
- SEO plugin recovery, E2E fixes, and CLI templates ([#37](https://github.com/DonaldMurillo/momentum-cms/pull/37), [#33](https://github.com/DonaldMurillo/momentum-cms/issues/33))
- add unified test runner script (npm run test:all) ([c02d24b](https://github.com/DonaldMurillo/momentum-cms/commit/c02d24b))

### 🩹 Fixes

- resolve lint errors, fix vitest config excludes, and fix CLI template test assertion ([5124f72](https://github.com/DonaldMurillo/momentum-cms/commit/5124f72))
- resolve 39 WCAG 2.1 AA accessibility violations across UI and admin libs ([1dcb108](https://github.com/DonaldMurillo/momentum-cms/commit/1dcb108))
- resolve all E2E test failures across Angular and Analog suites ([35c2285](https://github.com/DonaldMurillo/momentum-cms/commit/35c2285))
- complete Analog E2E parity with Express-to-h3 bridge and plugin sub-path exports ([7bca003](https://github.com/DonaldMurillo/momentum-cms/commit/7bca003))
- sitemap/robots use request Host for URLs and prefer slug over id ([7ad4691](https://github.com/DonaldMurillo/momentum-cms/commit/7ad4691))
- remove unused CardContent import and duplicate peerDependency ([e67f149](https://github.com/DonaldMurillo/momentum-cms/commit/e67f149))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.3.0 (2026-02-20)

### 🚀 Features

- add named tabs support with nested data grouping and UI improvements ([#30](https://github.com/DonaldMurillo/momentum-cms/pull/30))
- add SEO plugin ([#33](https://github.com/DonaldMurillo/momentum-cms/pull/33))
- add blocks showcase with theme-aware pages, articles listing, and app layout ([70c775a](https://github.com/DonaldMurillo/momentum-cms/commit/70c775a))
- add article slugs, detail pages, live preview, and fix PATCH field hooks ([454b61c](https://github.com/DonaldMurillo/momentum-cms/commit/454b61c))
- implement Payload-style migration CLI workflow with clone-test-apply safety ([#35](https://github.com/DonaldMurillo/momentum-cms/pull/35))

### 🩹 Fixes

- add safe HTML id generation for collection groups with spaces in names ([#31](https://github.com/DonaldMurillo/momentum-cms/pull/31))
- add safe HTML id generation for collection groups with spaces in names ([#31](https://github.com/DonaldMurillo/momentum-cms/pull/31))
- add auth guard and MIME validation to PATCH upload route; fix pagination with client-side filtering ([#32](https://github.com/DonaldMurillo/momentum-cms/pull/32))
- fix nav highlighting and resolve pre-existing E2E test failures ([#34](https://github.com/DonaldMurillo/momentum-cms/pull/34))
- move layout classes to host element in ArticlesPageComponent ([eb38f0e](https://github.com/DonaldMurillo/momentum-cms/commit/eb38f0e))
- address code review issues across admin, server-core, and e2e ([4664463](https://github.com/DonaldMurillo/momentum-cms/commit/4664463))
- resolve TypeScript build errors in migrations library and add to release ([8e9fda8](https://github.com/DonaldMurillo/momentum-cms/commit/8e9fda8))

### ❤️ Thank You

- Claude Haiku 4.5
- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.2.0 (2026-02-17)

### 🚀 Features

- add named tabs support with nested data grouping and tab UI improvements ([63ab63e](https://github.com/DonaldMurillo/momentum-cms/commit/63ab63e))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.10 (2026-02-17)

### 🩹 Fixes

- **create-momentum-app:** add shell option to execFileSync for Windows ([#28](https://github.com/DonaldMurillo/momentum-cms/pull/28))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.9 (2026-02-16)

### 🩹 Fixes

- **create-momentum-app:** add shell option to execFileSync for Windows compatibility ([5576ea8](https://github.com/DonaldMurillo/momentum-cms/commit/5576ea8))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.8 (2026-02-16)

### 🩹 Fixes

- correct repository URLs and add GitHub link to CLI ([#26](https://github.com/DonaldMurillo/momentum-cms/pull/26))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.7 (2026-02-16)

### 🩹 Fixes

- correct repository URLs and add GitHub link to CLI output ([f7e96bb](https://github.com/DonaldMurillo/momentum-cms/commit/f7e96bb))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.6 (2026-02-16)

### 🩹 Fixes

- **create-app:** use port 4200 for Angular template default ([d375f13](https://github.com/DonaldMurillo/momentum-cms/commit/d375f13))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.5 (2026-02-16)

### 🚀 Features

- **create-app:** add landing page, fix setup flow, theme detection, type generator, Playwright E2E ([5e0f4ed](https://github.com/DonaldMurillo/momentum-cms/commit/5e0f4ed))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.4 (2026-02-16)

### 🩹 Fixes

- **create-app:** wire admin routes and add missing peer deps to templates ([1356357](https://github.com/DonaldMurillo/momentum-cms/commit/1356357))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.3 (2026-02-16)

### 🩹 Fixes

- **ui:** add missing @angular/aria peer dependency ([eb08862](https://github.com/DonaldMurillo/momentum-cms/commit/eb08862))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.2 (2026-02-16)

### 🩹 Fixes

- **create-app:** fix Angular SSR, Analog builds, and CJS/ESM compatibility ([28d4d0a](https://github.com/DonaldMurillo/momentum-cms/commit/28d4d0a))
- **release:** centralize manifestRootsToUpdate to update both source and dist ([2b8f832](https://github.com/DonaldMurillo/momentum-cms/commit/2b8f832))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.1 (2026-02-16)

### 🩹 Fixes

- **create-app:** bump angular template typescript to ~5.9.2 ([10ef28e](https://github.com/DonaldMurillo/momentum-cms/commit/10ef28e))
- **create-app:** fix E2E test and template bugs for full pipeline validation ([4d7e3a9](https://github.com/DonaldMurillo/momentum-cms/commit/4d7e3a9))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.0 (2026-02-16)

### 🚀 Features

- Initialize Momentum CMS foundation ([f64f581](https://github.com/DonaldMurillo/momentum-cms/commit/f64f581))
- Implement admin UI with API integration and SSR hydration ([9ed7b2b](https://github.com/DonaldMurillo/momentum-cms/commit/9ed7b2b))
- Add Tailwind design system and fix SQLite reliability ([6dd79b1](https://github.com/DonaldMurillo/momentum-cms/commit/6dd79b1))
- Add authentication, UI library, and theme system ([0d38720](https://github.com/DonaldMurillo/momentum-cms/commit/0d38720))
- Add type-safe Momentum API with signal support ([aee6c02](https://github.com/DonaldMurillo/momentum-cms/commit/aee6c02))
- Add TransferState support for SSR hydration ([9563cdb](https://github.com/DonaldMurillo/momentum-cms/commit/9563cdb))
- Add role-based access control system ([ebadbbe](https://github.com/DonaldMurillo/momentum-cms/commit/ebadbbe))
- Add typed access control helper functions ([980d8d0](https://github.com/DonaldMurillo/momentum-cms/commit/980d8d0))
- Add Claude code quality and accessibility hooks ([be3c3d1](https://github.com/DonaldMurillo/momentum-cms/commit/be3c3d1))
- Add seeding feature with idempotent data initialization ([#1](https://github.com/DonaldMurillo/momentum-cms/pull/1))
- migrate landing page to Momentum CMS UI components ([#3](https://github.com/DonaldMurillo/momentum-cms/pull/3))
- Add document versioning and drafts system ([#5](https://github.com/DonaldMurillo/momentum-cms/pull/5))
- add password reset flow with E2E tests ([#6](https://github.com/DonaldMurillo/momentum-cms/pull/6))
- UI polish fixes and database-level FK constraints for relationship integrity ([#13](https://github.com/DonaldMurillo/momentum-cms/pull/13))
- Add display formatting and complex field rendering ([#14](https://github.com/DonaldMurillo/momentum-cms/pull/14))
- visual block editor & auth-gated admin mode ([#18](https://github.com/DonaldMurillo/momentum-cms/pull/18))
- implement globals (singleton collections) with full stack support ([#20](https://github.com/DonaldMurillo/momentum-cms/pull/20))
- add tracking rules, content performance, and block analytics ([#21](https://github.com/DonaldMurillo/momentum-cms/pull/21))
- implement soft deletes with full stack support ([#22](https://github.com/DonaldMurillo/momentum-cms/pull/22))
- **ui:** enhance command palette with autofocus, filtering, and keyboard nav ([#2](https://github.com/DonaldMurillo/momentum-cms/pull/2))

### 🩹 Fixes

- address security and reliability issues from code review ([#7](https://github.com/DonaldMurillo/momentum-cms/pull/7))
- address security vulnerabilities from code review ([#9](https://github.com/DonaldMurillo/momentum-cms/pull/9))
- address 7 critical and high-severity security and validation bugs ([#12](https://github.com/DonaldMurillo/momentum-cms/pull/12))
- resolve CUD toast interceptor issues ([#17](https://github.com/DonaldMurillo/momentum-cms/pull/17), [#1](https://github.com/DonaldMurillo/momentum-cms/issues/1), [#2](https://github.com/DonaldMurillo/momentum-cms/issues/2), [#3](https://github.com/DonaldMurillo/momentum-cms/issues/3), [#4](https://github.com/DonaldMurillo/momentum-cms/issues/4))
- **a11y:** resolve E2E, focus indicator, and error sanitization issues ([#19](https://github.com/DonaldMurillo/momentum-cms/pull/19))
- **admin:** resolve entity sheet issues ([#16](https://github.com/DonaldMurillo/momentum-cms/pull/16))

### ❤️ Thank You

- Claude Haiku 4.5
- Claude Opus 4.5
- Claude Opus 4.6
- Donald Murillo @DonaldMurillo
