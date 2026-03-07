---
name: prepare-release
description: Prepare a patch/minor/major version release for all Momentum CMS packages. Bumps versions, generates changelogs, verifies builds/tests, adds new packages to Nx release config, and commits. Triggers include "prepare release", "bump version", "release patch", or "/prepare-release".
argument-hint: <patch|minor|major>
allowed-tools: Bash(npx *), Bash(npm *), Bash(grep *), Bash(find *), Bash(ls *), Bash(git *), Read, Glob, Grep, Edit, Write
---

# Prepare Release Skill

Prepare a new version release for all `@momentumcms/*` packages in the monorepo using `nx release`.

## Inputs

- **bump type**: `patch` (default), `minor`, or `major` from the argument
- If no argument provided, default to `patch`

## Step 1: Verify Git Tags Exist

Nx Release resolves the current version from git tags matching `v{version}`. Verify the latest tag matches the current package version:

```bash
git tag -l 'v*' | sort -V | tail -1
grep '"version"' libs/core/package.json
```

If the latest tag doesn't match the current version (e.g., packages are at `0.5.3` but latest tag is `v0.5.0`), create the missing tag on the correct commit:

```bash
git log --all --oneline | grep "bump version to X.Y.Z"
git tag vX.Y.Z <commit-hash>
```

**This is critical** — without the correct tag, Nx Release will calculate the wrong next version.

## Step 2: Verify New Packages Are in Nx Release Config

Read `nx.json` and check the `release.projects` array. Every library in `libs/` and `libs/plugins/` that has a `package.json` with `@momentumcms/` name MUST be in this array.

To find all publishable packages:

```bash
grep -r '"@momentumcms/' libs/*/package.json libs/plugins/*/package.json apps/create-momentum-app/package.json | grep '"name"'
```

Compare against `release.projects` in `nx.json`. If any are missing:

1. Add them to the `release.projects` array in `nx.json`
2. Verify the package's `project.json` has an `nx-release-publish` target:
   ```json
   "nx-release-publish": {
       "options": {
           "packageRoot": "dist/{projectRoot}",
           "access": "public"
       }
   }
   ```

## Step 3: Dry Run

Run `nx release` in dry-run mode to preview version bumps and changelogs:

```bash
npx nx release --specifier=<bump> --dry-run --skip-publish 2>&1
```

Check the output for:

- **Correct base version** — should resolve from the latest git tag
- **Correct new version** — patch/minor/major applied correctly
- **Changelog entries** — features, fixes, and contributors look right
- **Errors** — especially peer dependency range issues (e.g., `preserveMatchingDependencyRanges` failures). Fix any range issues in the relevant `package.json` before proceeding.

## Step 4: Run Full Test Suite

Run the full test suite to verify nothing is broken:

```bash
npm run test:all -- --skip cli-scaffold
```

The CLI scaffold test is slow and unrelated to library code; skip it unless the release includes CLI template changes. Run in background since it takes a while.

Check results:

- **Unit Tests**: Must pass (0 failures)
- **Angular E2E**: Must pass
- **Analog E2E**: Must pass (flaky tests that retry and pass are OK)
- **Migration Tests**: Must pass

## Step 5: Execute Release

Once dry run and tests look good, run for real:

```bash
npx nx release --specifier=<bump> --skip-publish
```

This will:

1. **Build all packages** (via `preVersionCommand`)
2. **Bump versions** in all `package.json` files (source and dist)
3. **Update internal dependency versions** automatically
4. **Generate per-project changelogs** from conventional commits
5. **Stage, commit, and tag** with `chore(release): publish X.Y.Z` and `vX.Y.Z`

## Step 6: Verify

```bash
git log --oneline -3
git tag -l 'v*' | sort -V | tail -3
grep '"version"' libs/core/package.json dist/libs/core/package.json
```

## Step 7: Summary

Print a summary:

- Old version → New version
- Number of packages bumped
- Any new packages added to release config
- Test results (or note if still running)
- Reminder: `npx nx release publish` to publish to npm (do NOT run this automatically)
- Reminder: `git push --follow-tags` to push the release commit and tag

## Important Notes

- **Never run `npx nx release publish`** without explicit user confirmation
- **Never run `git push`** without explicit user confirmation
- All packages use lockstep versioning (same version number)
- The root `package.json` version (`0.0.0`) is intentionally static and should NOT be bumped
- Nx Release handles version bumping, dependency updates, changelogs, commit, and tagging — do NOT do these manually
- The `nx.json` config has `conventionalCommits: true` so changelogs are generated from commit messages automatically
- `manifestRootsToUpdate` includes `dist/{projectRoot}` so dist versions are updated too
