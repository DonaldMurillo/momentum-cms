# Publishing to npm

Momentum CMS packages are published under the `@momentumcms` scope on npm. This guide covers how to release new versions.

## Prerequisites

### 1. npm Organization

All scoped packages (`@momentumcms/*`) are published under the [momentumcms npm org](https://www.npmjs.com/org/momentumcms). If the org doesn't exist, create it at [npmjs.com/org/create](https://www.npmjs.com/org/create) (free tier works for public packages).

### 2. npm Authentication

```bash
# Login to npm
npm login

# Verify you're logged in
npm whoami
```

**Granular Access Tokens (recommended for CI):**

1. Go to [npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens)
2. Create a **Granular Access Token** with publish permissions
3. For CI, use an "Automation" token type (bypasses 2FA requirement)
4. Set it as `NPM_TOKEN` in your CI environment

### 3. 2FA Considerations

If your npm account has 2FA enabled, you have two options:

- **Interactive publish:** Use `--otp=CODE` flag with a code from your authenticator app
- **Automation token:** Create a granular access token with 2FA bypass (recommended for CI)

## How Releases Work

Momentum uses [Nx Release](https://nx.dev/features/manage-releases) with these key behaviors:

### Version Resolution

- Versions are resolved from **git tags** (not `package.json` files)
- Source `package.json` files stay at `0.0.1` — this is intentional
- The `dist/` `package.json` files get the real version during the release process
- The release tag pattern is `v{version}` (e.g., `v0.1.0`)

### Fixed Release Group

All 14 publishable packages share the same version number. When one bumps, they all bump.

### Conventional Commits

Version bumps are determined automatically from commit messages:

| Prefix                         | Version Bump  | Example                                           |
| ------------------------------ | ------------- | ------------------------------------------------- |
| `fix:`                         | Patch (0.0.x) | `fix(auth): resolve token refresh race condition` |
| `feat:`                        | Minor (0.x.0) | `feat: implement soft deletes`                    |
| `feat!:` or `BREAKING CHANGE:` | Major (x.0.0) | `feat!: redesign collection config API`           |

## Publishing a Release

### First Release

```bash
npx nx release --first-release --yes
```

The `--first-release` flag tells Nx there's no prior version to compare against. Only needed once.

### Subsequent Releases

```bash
npx nx release --yes
```

This will:

1. **Build** all packages (`preVersionCommand`)
2. **Determine version** from conventional commits since the last tag
3. **Update** `dist/` `package.json` files with the new version
4. **Generate** changelogs for each project
5. **Commit** the changelog changes
6. **Tag** the commit with `v{version}`
7. **Publish** all 14 packages to npm

The `--yes` flag auto-confirms the publish step. Without it, Nx will skip publishing.

### Publish Only (Re-publish After Failure)

If versioning/tagging succeeded but publishing failed:

```bash
npx nx release publish
```

This runs only the publish step using whatever is in `dist/`.

**Important:** If the build step hasn't run, you need to build first:

```bash
npx nx run-many -t build && npx nx release publish
```

## Troubleshooting

### "No changes were detected" / Skipped Everything

**Cause:** The git tag already exists and there are no new conventional commits since it.

**Fix:** Delete the tag and re-run:

```bash
git tag -d v{version}
npx nx release --first-release --yes
```

### "Skipped publishing packages"

**Cause:** Missing `--yes` flag. Nx skips publishing without explicit confirmation.

**Fix:** Always use `--yes`:

```bash
npx nx release --yes
```

### 402 Payment Required / "You must sign up for private packages"

**Cause:** Scoped packages (`@momentumcms/*`) default to private on npm, which requires a paid plan.

**Fix:** Already resolved. All `project.json` files include `"access": "public"` in the `nx-release-publish` target. If you add a new publishable library, make sure to include:

```json
"nx-release-publish": {
  "options": {
    "packageRoot": "dist/{projectRoot}",
    "access": "public"
  }
}
```

### 403 Forbidden / "Two-factor authentication required"

**Cause:** npm account requires 2FA for publishing.

**Fix:** Either use `--otp` or create an automation token:

```bash
# Option A: One-time code
npx nx release publish --otp=123456

# Option B: Automation token (recommended)
npm config set //registry.npmjs.org/:_authToken=YOUR_AUTOMATION_TOKEN
```

### 404 Not Found / "Scope not found"

**Cause:** The npm organization doesn't exist.

**Fix:** Create it at [npmjs.com/org/create](https://www.npmjs.com/org/create).

### Source package.json Still Shows 0.0.1

**This is expected.** The `manifestRootsToUpdate` in each `project.json` only targets `dist/{projectRoot}`. Source versions stay fixed. The real version comes from git tags.

## Publishable Projects

These 14 projects are included in each release (configured in `nx.json`):

| Project             | npm Package                      |
| ------------------- | -------------------------------- |
| core                | `@momentumcms/core`              |
| logger              | `@momentumcms/logger`            |
| storage             | `@momentumcms/storage`           |
| ui                  | `@momentumcms/ui`                |
| admin               | `@momentumcms/admin`             |
| auth                | `@momentumcms/auth`              |
| db-drizzle          | `@momentumcms/db-drizzle`        |
| server-core         | `@momentumcms/server-core`       |
| server-express      | `@momentumcms/server-express`    |
| server-analog       | `@momentumcms/server-analog`     |
| plugins-core        | `@momentumcms/plugins-core`      |
| plugins-analytics   | `@momentumcms/plugins-analytics` |
| plugins-otel        | `@momentumcms/plugins-otel`      |
| create-momentum-app | `create-momentum-app`            |

### Adding a New Publishable Library

1. Add the project name to the `release.projects` array in `nx.json`
2. Add release config to the project's `project.json`:

```json
{
	"release": {
		"version": {
			"manifestRootsToUpdate": ["dist/{projectRoot}"],
			"currentVersionResolver": "git-tag",
			"fallbackCurrentVersionResolver": "disk"
		}
	},
	"targets": {
		"nx-release-publish": {
			"options": {
				"packageRoot": "dist/{projectRoot}",
				"access": "public"
			}
		}
	}
}
```

3. Set `"version": "0.0.1"` in the library's source `package.json`
