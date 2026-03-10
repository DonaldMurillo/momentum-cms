## 0.5.7 (2026-03-10)

### 🩹 Fixes

- migration mode fixes, first-user admin, and overrideAccess bypass ([bf164074](https://github.com/DonaldMurillo/momentum-cms/commit/bf164074))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.6 (2026-03-10)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.5.5 (2026-03-09)

### 🚀 Features

- extract syncDatabaseSchema + fix findById breaking change ([#52](https://github.com/DonaldMurillo/momentum-cms/pull/52))
- swappable admin pages & layout slots with security hardening ([#51](https://github.com/DonaldMurillo/momentum-cms/pull/51))
- Versioning & drafts with draft/publish workflow ([#50](https://github.com/DonaldMurillo/momentum-cms/pull/50))
- NestJS server adapter + E2E stabilization (0.5.2) ([#48](https://github.com/DonaldMurillo/momentum-cms/pull/48))
- S3, auth plugin wiring, redirects, and E2E tooling ([#41](https://github.com/DonaldMurillo/momentum-cms/pull/41))
- client-side page view tracking and content performance improvements ([#39](https://github.com/DonaldMurillo/momentum-cms/pull/39))
- SEO plugin recovery, E2E fixes, and CLI templates ([#37](https://github.com/DonaldMurillo/momentum-cms/pull/37), [#33](https://github.com/DonaldMurillo/momentum-cms/issues/33))
- blocks showcase with articles, pages, and UI fixes ([#36](https://github.com/DonaldMurillo/momentum-cms/pull/36))
- implement Payload-style migration CLI workflow with clone-test-apply safety ([#35](https://github.com/DonaldMurillo/momentum-cms/pull/35))
- add named tabs support with nested data grouping and UI improvements ([#30](https://github.com/DonaldMurillo/momentum-cms/pull/30))
- implement soft deletes with full stack support ([#22](https://github.com/DonaldMurillo/momentum-cms/pull/22))
- add tracking rules, content performance, and block analytics ([#21](https://github.com/DonaldMurillo/momentum-cms/pull/21))
- implement globals (singleton collections) with full stack support ([#20](https://github.com/DonaldMurillo/momentum-cms/pull/20))
- visual block editor & auth-gated admin mode ([#18](https://github.com/DonaldMurillo/momentum-cms/pull/18))
- Add display formatting and complex field rendering ([#14](https://github.com/DonaldMurillo/momentum-cms/pull/14))
- UI polish fixes and database-level FK constraints for relationship integrity ([#13](https://github.com/DonaldMurillo/momentum-cms/pull/13))
- Add document versioning and drafts system ([#5](https://github.com/DonaldMurillo/momentum-cms/pull/5))
- Add seeding feature with idempotent data initialization ([#1](https://github.com/DonaldMurillo/momentum-cms/pull/1))
- Add typed access control helper functions ([980d8d0a](https://github.com/DonaldMurillo/momentum-cms/commit/980d8d0a))
- Implement admin UI with API integration and SSR hydration ([9ed7b2bd](https://github.com/DonaldMurillo/momentum-cms/commit/9ed7b2bd))
- Initialize Momentum CMS foundation ([f64f5817](https://github.com/DonaldMurillo/momentum-cms/commit/f64f5817))

### 🩹 Fixes

- add public access to form-builder npm publish config ([#46](https://github.com/DonaldMurillo/momentum-cms/pull/46))
- queue feature code review issues ([#45](https://github.com/DonaldMurillo/momentum-cms/pull/45))
- Resolve non-null assertion bugs and CLAUDE.md violations ([#44](https://github.com/DonaldMurillo/momentum-cms/pull/44))
- fix nav highlighting and resolve pre-existing E2E test failures ([#34](https://github.com/DonaldMurillo/momentum-cms/pull/34))
- add auth guard and MIME validation to PATCH upload route; fix pagination with client-side filtering ([#32](https://github.com/DonaldMurillo/momentum-cms/pull/32))
- **create-momentum-app:** add shell option to execFileSync for Windows ([#28](https://github.com/DonaldMurillo/momentum-cms/pull/28))
- correct repository URLs and add GitHub link to CLI ([#26](https://github.com/DonaldMurillo/momentum-cms/pull/26))
- resolve CUD toast interceptor issues ([#17](https://github.com/DonaldMurillo/momentum-cms/pull/17), [#1](https://github.com/DonaldMurillo/momentum-cms/issues/1), [#2](https://github.com/DonaldMurillo/momentum-cms/issues/2), [#3](https://github.com/DonaldMurillo/momentum-cms/issues/3), [#4](https://github.com/DonaldMurillo/momentum-cms/issues/4))
- address 7 critical and high-severity security and validation bugs ([#12](https://github.com/DonaldMurillo/momentum-cms/pull/12))
- address security vulnerabilities from code review ([#9](https://github.com/DonaldMurillo/momentum-cms/pull/9))
- address security and reliability issues from code review ([#7](https://github.com/DonaldMurillo/momentum-cms/pull/7))

### ❤️ Thank You

- Claude Haiku 4.5
- Claude Opus 4.5
- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.4 (2026-03-07)

### 🚀 Features

- Versioning & drafts with draft/publish workflow ([#50](https://github.com/DonaldMurillo/momentum-cms/pull/50))
- swappable admin pages & layout slots with config-driven code generation ([425b4199](https://github.com/DonaldMurillo/momentum-cms/commit/425b4199))

### 🩹 Fixes

- race conditions, code injection, and test quality in swappable admin ([eaa9dcec](https://github.com/DonaldMurillo/momentum-cms/commit/eaa9dcec))

### ❤️ Thank You

- Claude Haiku 4.5
- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.0 (2026-02-23)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.4.1 (2026-02-22)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.4.0 (2026-02-22)

### 🚀 Features

- SEO plugin recovery, E2E fixes, and CLI templates ([#37](https://github.com/DonaldMurillo/momentum-cms/pull/37), [#33](https://github.com/DonaldMurillo/momentum-cms/issues/33))
- blocks showcase with articles, pages, and UI fixes ([#36](https://github.com/DonaldMurillo/momentum-cms/pull/36))

### 🩹 Fixes

- complete Analog E2E parity with Express-to-h3 bridge and plugin sub-path exports ([7bca003](https://github.com/DonaldMurillo/momentum-cms/commit/7bca003))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.3.0 (2026-02-20)

### 🚀 Features

- implement Payload-style migration CLI workflow with clone-test-apply safety ([#35](https://github.com/DonaldMurillo/momentum-cms/pull/35))
- add named tabs support with nested data grouping and UI improvements ([#30](https://github.com/DonaldMurillo/momentum-cms/pull/30))

### 🩹 Fixes

- fix nav highlighting and resolve pre-existing E2E test failures ([#34](https://github.com/DonaldMurillo/momentum-cms/pull/34))
- add auth guard and MIME validation to PATCH upload route; fix pagination with client-side filtering ([#32](https://github.com/DonaldMurillo/momentum-cms/pull/32))

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

This was a version bump only for core to align it with other projects, there were no code changes.

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

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.1.5 (2026-02-16)

### 🚀 Features

- **create-app:** add landing page, fix setup flow, theme detection, type generator, Playwright E2E ([5e0f4ed](https://github.com/DonaldMurillo/momentum-cms/commit/5e0f4ed))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.4 (2026-02-16)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.1.3 (2026-02-16)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.1.2 (2026-02-16)

### 🩹 Fixes

- **release:** centralize manifestRootsToUpdate to update both source and dist ([2b8f832](https://github.com/DonaldMurillo/momentum-cms/commit/2b8f832))
- **create-app:** fix Angular SSR, Analog builds, and CJS/ESM compatibility ([28d4d0a](https://github.com/DonaldMurillo/momentum-cms/commit/28d4d0a))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.1 (2026-02-16)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.1.0 (2026-02-16)

### 🚀 Features

- implement soft deletes with full stack support ([#22](https://github.com/DonaldMurillo/momentum-cms/pull/22))
- add tracking rules, content performance, and block analytics ([#21](https://github.com/DonaldMurillo/momentum-cms/pull/21))
- implement globals (singleton collections) with full stack support ([#20](https://github.com/DonaldMurillo/momentum-cms/pull/20))
- visual block editor & auth-gated admin mode ([#18](https://github.com/DonaldMurillo/momentum-cms/pull/18))
- Add display formatting and complex field rendering ([#14](https://github.com/DonaldMurillo/momentum-cms/pull/14))
- UI polish fixes and database-level FK constraints for relationship integrity ([#13](https://github.com/DonaldMurillo/momentum-cms/pull/13))
- Add document versioning and drafts system ([#5](https://github.com/DonaldMurillo/momentum-cms/pull/5))
- Add seeding feature with idempotent data initialization ([#1](https://github.com/DonaldMurillo/momentum-cms/pull/1))
- Add typed access control helper functions ([980d8d0](https://github.com/DonaldMurillo/momentum-cms/commit/980d8d0))
- Add type-safe Momentum API with signal support ([aee6c02](https://github.com/DonaldMurillo/momentum-cms/commit/aee6c02))
- Implement admin UI with API integration and SSR hydration ([9ed7b2b](https://github.com/DonaldMurillo/momentum-cms/commit/9ed7b2b))
- Initialize Momentum CMS foundation ([f64f581](https://github.com/DonaldMurillo/momentum-cms/commit/f64f581))

### 🩹 Fixes

- resolve CUD toast interceptor issues ([#17](https://github.com/DonaldMurillo/momentum-cms/pull/17), [#1](https://github.com/DonaldMurillo/momentum-cms/issues/1), [#2](https://github.com/DonaldMurillo/momentum-cms/issues/2), [#3](https://github.com/DonaldMurillo/momentum-cms/issues/3), [#4](https://github.com/DonaldMurillo/momentum-cms/issues/4))
- address 7 critical and high-severity security and validation bugs ([#12](https://github.com/DonaldMurillo/momentum-cms/pull/12))
- address security vulnerabilities from code review ([#9](https://github.com/DonaldMurillo/momentum-cms/pull/9))
- address security and reliability issues from code review ([#7](https://github.com/DonaldMurillo/momentum-cms/pull/7))

### ❤️ Thank You

- Claude Haiku 4.5
- Claude Opus 4.5
- Claude Opus 4.6
- Donald Murillo @DonaldMurillo
