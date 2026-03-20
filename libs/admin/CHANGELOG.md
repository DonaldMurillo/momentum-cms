## 0.5.11 (2026-03-20)

### 🩹 Fixes

- system field validation, CORS wildcard, localStorage tests & API key enumeration ([228d4a1e](https://github.com/DonaldMurillo/momentum-cms/commit/228d4a1e))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.10 (2026-03-13)

### 🚀 Features

- centralize admin icon provider — all heroicons available by default ([39a21e2c](https://github.com/DonaldMurillo/momentum-cms/commit/39a21e2c))
- headless theme editor with CSS injection protection, validation, sidebar icons & E2E ([1fd7fb2d](https://github.com/DonaldMurillo/momentum-cms/commit/1fd7fb2d))

### 🩹 Fixes

- register missing plugin sidebar icons + update skills with icon checklist ([28e45b4b](https://github.com/DonaldMurillo/momentum-cms/commit/28e45b4b))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.5.9 (2026-03-10)

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.5.8 (2026-03-10)

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.5.7 (2026-03-10)

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.5.6 (2026-03-10)

This was a version bump only for admin to align it with other projects, there were no code changes.

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
- add named tabs support with nested data grouping and UI improvements ([#30](https://github.com/DonaldMurillo/momentum-cms/pull/30))
- implement soft deletes with full stack support ([#22](https://github.com/DonaldMurillo/momentum-cms/pull/22))
- add tracking rules, content performance, and block analytics ([#21](https://github.com/DonaldMurillo/momentum-cms/pull/21))
- implement globals (singleton collections) with full stack support ([#20](https://github.com/DonaldMurillo/momentum-cms/pull/20))
- visual block editor & auth-gated admin mode ([#18](https://github.com/DonaldMurillo/momentum-cms/pull/18))
- Add display formatting and complex field rendering ([#14](https://github.com/DonaldMurillo/momentum-cms/pull/14))
- UI polish fixes and database-level FK constraints for relationship integrity ([#13](https://github.com/DonaldMurillo/momentum-cms/pull/13))
- add password reset flow with E2E tests ([#6](https://github.com/DonaldMurillo/momentum-cms/pull/6))
- Add document versioning and drafts system ([#5](https://github.com/DonaldMurillo/momentum-cms/pull/5))
- migrate landing page to Momentum CMS UI components ([#3](https://github.com/DonaldMurillo/momentum-cms/pull/3))
- **ui:** enhance command palette with autofocus, filtering, and keyboard nav ([#2](https://github.com/DonaldMurillo/momentum-cms/pull/2))
- Add role-based access control system ([ebadbbef](https://github.com/DonaldMurillo/momentum-cms/commit/ebadbbef))
- Add TransferState support for SSR hydration ([9563cdb8](https://github.com/DonaldMurillo/momentum-cms/commit/9563cdb8))
- Add type-safe Momentum API with signal support ([aee6c029](https://github.com/DonaldMurillo/momentum-cms/commit/aee6c029))
- Add authentication, UI library, and theme system ([0d387205](https://github.com/DonaldMurillo/momentum-cms/commit/0d387205))
- Add Tailwind design system and fix SQLite reliability ([6dd79b11](https://github.com/DonaldMurillo/momentum-cms/commit/6dd79b11))
- Implement admin UI with API integration and SSR hydration ([9ed7b2bd](https://github.com/DonaldMurillo/momentum-cms/commit/9ed7b2bd))
- Initialize Momentum CMS foundation ([f64f5817](https://github.com/DonaldMurillo/momentum-cms/commit/f64f5817))

### 🩹 Fixes

- Analog versioning access control + E2E improvements ([#54](https://github.com/DonaldMurillo/momentum-cms/pull/54))
- add public access to form-builder npm publish config ([#46](https://github.com/DonaldMurillo/momentum-cms/pull/46))
- Resolve non-null assertion bugs and CLAUDE.md violations ([#44](https://github.com/DonaldMurillo/momentum-cms/pull/44))
- fix nav highlighting and resolve pre-existing E2E test failures ([#34](https://github.com/DonaldMurillo/momentum-cms/pull/34))
- add auth guard and MIME validation to PATCH upload route; fix pagination with client-side filtering ([#32](https://github.com/DonaldMurillo/momentum-cms/pull/32))
- add safe HTML id generation for collection groups with spaces in names ([#31](https://github.com/DonaldMurillo/momentum-cms/pull/31))
- **create-momentum-app:** add shell option to execFileSync for Windows ([#28](https://github.com/DonaldMurillo/momentum-cms/pull/28))
- correct repository URLs and add GitHub link to CLI ([#26](https://github.com/DonaldMurillo/momentum-cms/pull/26))
- **a11y:** resolve E2E, focus indicator, and error sanitization issues ([#19](https://github.com/DonaldMurillo/momentum-cms/pull/19))
- resolve CUD toast interceptor issues ([#17](https://github.com/DonaldMurillo/momentum-cms/pull/17), [#1](https://github.com/DonaldMurillo/momentum-cms/issues/1), [#2](https://github.com/DonaldMurillo/momentum-cms/issues/2), [#3](https://github.com/DonaldMurillo/momentum-cms/issues/3), [#4](https://github.com/DonaldMurillo/momentum-cms/issues/4))
- **admin:** resolve entity sheet issues ([#16](https://github.com/DonaldMurillo/momentum-cms/pull/16))
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

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.4.1 (2026-02-22)

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.4.0 (2026-02-22)

### 🚀 Features

- SEO plugin recovery, E2E fixes, and CLI templates ([#37](https://github.com/DonaldMurillo/momentum-cms/pull/37), [#33](https://github.com/DonaldMurillo/momentum-cms/issues/33))
- blocks showcase with articles, pages, and UI fixes ([#36](https://github.com/DonaldMurillo/momentum-cms/pull/36))

### 🩹 Fixes

- resolve all E2E test failures across Angular and Analog suites ([35c2285](https://github.com/DonaldMurillo/momentum-cms/commit/35c2285))
- resolve 39 WCAG 2.1 AA accessibility violations across UI and admin libs ([1dcb108](https://github.com/DonaldMurillo/momentum-cms/commit/1dcb108))
- resolve lint errors, fix vitest config excludes, and fix CLI template test assertion ([5124f72](https://github.com/DonaldMurillo/momentum-cms/commit/5124f72))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.3.0 (2026-02-20)

### 🚀 Features

- add article slugs, detail pages, live preview, and fix PATCH field hooks ([454b61c](https://github.com/DonaldMurillo/momentum-cms/commit/454b61c))
- add named tabs support with nested data grouping and UI improvements ([#30](https://github.com/DonaldMurillo/momentum-cms/pull/30))

### 🩹 Fixes

- address code review issues across admin, server-core, and e2e ([4664463](https://github.com/DonaldMurillo/momentum-cms/commit/4664463))
- fix nav highlighting and resolve pre-existing E2E test failures ([#34](https://github.com/DonaldMurillo/momentum-cms/pull/34))
- add auth guard and MIME validation to PATCH upload route; fix pagination with client-side filtering ([#32](https://github.com/DonaldMurillo/momentum-cms/pull/32))
- add safe HTML id generation for collection groups with spaces in names ([#31](https://github.com/DonaldMurillo/momentum-cms/pull/31))

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

This was a version bump only for admin to align it with other projects, there were no code changes.

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

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.1.5 (2026-02-16)

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.1.4 (2026-02-16)

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.1.3 (2026-02-16)

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.1.2 (2026-02-16)

### 🩹 Fixes

- **release:** centralize manifestRootsToUpdate to update both source and dist ([2b8f832](https://github.com/DonaldMurillo/momentum-cms/commit/2b8f832))
- **create-app:** fix Angular SSR, Analog builds, and CJS/ESM compatibility ([28d4d0a](https://github.com/DonaldMurillo/momentum-cms/commit/28d4d0a))

### ❤️ Thank You

- Claude Opus 4.6
- Donald Murillo @DonaldMurillo

## 0.1.1 (2026-02-16)

This was a version bump only for admin to align it with other projects, there were no code changes.

## 0.1.0 (2026-02-16)

### 🚀 Features

- implement soft deletes with full stack support ([#22](https://github.com/DonaldMurillo/momentum-cms/pull/22))
- add tracking rules, content performance, and block analytics ([#21](https://github.com/DonaldMurillo/momentum-cms/pull/21))
- implement globals (singleton collections) with full stack support ([#20](https://github.com/DonaldMurillo/momentum-cms/pull/20))
- visual block editor & auth-gated admin mode ([#18](https://github.com/DonaldMurillo/momentum-cms/pull/18))
- Add display formatting and complex field rendering ([#14](https://github.com/DonaldMurillo/momentum-cms/pull/14))
- UI polish fixes and database-level FK constraints for relationship integrity ([#13](https://github.com/DonaldMurillo/momentum-cms/pull/13))
- add password reset flow with E2E tests ([#6](https://github.com/DonaldMurillo/momentum-cms/pull/6))
- Add document versioning and drafts system ([#5](https://github.com/DonaldMurillo/momentum-cms/pull/5))
- migrate landing page to Momentum CMS UI components ([#3](https://github.com/DonaldMurillo/momentum-cms/pull/3))
- **ui:** enhance command palette with autofocus, filtering, and keyboard nav ([#2](https://github.com/DonaldMurillo/momentum-cms/pull/2))
- Add role-based access control system ([ebadbbe](https://github.com/DonaldMurillo/momentum-cms/commit/ebadbbe))
- Add TransferState support for SSR hydration ([9563cdb](https://github.com/DonaldMurillo/momentum-cms/commit/9563cdb))
- Add type-safe Momentum API with signal support ([aee6c02](https://github.com/DonaldMurillo/momentum-cms/commit/aee6c02))
- Add authentication, UI library, and theme system ([0d38720](https://github.com/DonaldMurillo/momentum-cms/commit/0d38720))
- Add Tailwind design system and fix SQLite reliability ([6dd79b1](https://github.com/DonaldMurillo/momentum-cms/commit/6dd79b1))
- Implement admin UI with API integration and SSR hydration ([9ed7b2b](https://github.com/DonaldMurillo/momentum-cms/commit/9ed7b2b))
- Initialize Momentum CMS foundation ([f64f581](https://github.com/DonaldMurillo/momentum-cms/commit/f64f581))

### 🩹 Fixes

- **a11y:** resolve E2E, focus indicator, and error sanitization issues ([#19](https://github.com/DonaldMurillo/momentum-cms/pull/19))
- resolve CUD toast interceptor issues ([#17](https://github.com/DonaldMurillo/momentum-cms/pull/17), [#1](https://github.com/DonaldMurillo/momentum-cms/issues/1), [#2](https://github.com/DonaldMurillo/momentum-cms/issues/2), [#3](https://github.com/DonaldMurillo/momentum-cms/issues/3), [#4](https://github.com/DonaldMurillo/momentum-cms/issues/4))
- **admin:** resolve entity sheet issues ([#16](https://github.com/DonaldMurillo/momentum-cms/pull/16))
- address 7 critical and high-severity security and validation bugs ([#12](https://github.com/DonaldMurillo/momentum-cms/pull/12))
- address security vulnerabilities from code review ([#9](https://github.com/DonaldMurillo/momentum-cms/pull/9))
- address security and reliability issues from code review ([#7](https://github.com/DonaldMurillo/momentum-cms/pull/7))

### ❤️ Thank You

- Claude Haiku 4.5
- Claude Opus 4.5
- Claude Opus 4.6
- Donald Murillo @DonaldMurillo
