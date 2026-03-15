---
name: skill-eval
description: Run structured evaluations comparing skill vs no-skill performance. Measures assertion pass rates, timing, and output quality to systematically improve skills.
argument-hint: <skill-name> [--iteration N] [--test-case name]
allowed-tools: Bash(*), Read, Glob, Grep, Write, Edit, Agent
---

# Skill Evaluation Runner

Run structured evaluations for a skill by testing prompts with and without the skill loaded, grading outputs against assertions, and producing comparison benchmarks.

## Arguments

- First argument: skill name (must match a directory in `.claude/skills/`)
- `--iteration N`: iteration number (default: auto-increment from existing)
- `--test-case name`: run only a specific test case (default: all)

## Workflow

### Step 1: Load and Validate

1. Read `.claude/skills/$SKILL/evals/evals.json`
2. Validate structure: each test case must have `name`, `prompt`, `assertions`
3. If `--test-case` specified, filter to that single case

### Step 2: Prepare Workspace

1. Determine iteration number:
   - If `--iteration N` provided, use N
   - Otherwise, check `.claude/skill-evals/$SKILL-workspace/` for existing `iteration-*` dirs and use next number
   - Default to 1 if none exist
2. Create workspace directory: `.claude/skill-evals/$SKILL-workspace/iteration-$N/`

### Step 3: Read Skill Content

Read the full content of `.claude/skills/$SKILL/SKILL.md` — this will be inlined into the "with skill" agent prompt. Strip the YAML frontmatter (everything between the opening and closing `---`).

### Step 4: For Each Test Case

For each test case in the evals:

#### 4a: Checkpoint Git State

```bash
git stash push -m "skill-eval-$SKILL-$TEST_CASE" --include-untracked
```

If there's nothing to stash (clean working tree), that's fine — just note it.

#### 4b: Run WITH Skill

1. Record `start_time = Date.now()`
2. Launch a subagent (Agent tool, `subagent_type: "general-purpose"`, `isolation: "worktree"`) with this prompt:

```
You are being evaluated on a coding task. Follow the instructions below carefully.

## Skill Instructions

<skill_content>
{content of SKILL.md, frontmatter stripped}
</skill_content>

## Task

{test_case.prompt}

## Rules
- Work in the current repository
- Do NOT read any evals.json files
- Do NOT look at .claude/skill-evals/
- Complete the task to the best of your ability following the skill instructions
```

3. Record `end_time = Date.now()` and `duration_seconds = (end - start) / 1000`
4. After the agent completes, capture the git diff of changes:
   ```bash
   git diff HEAD
   git diff HEAD --name-only
   ```
5. Save the diff output to `with_skill/outputs/changes.diff`
6. Save the list of new/changed files to `with_skill/outputs/files.txt`
7. Run assertions (see Step 5) and save to `with_skill/grading.json`
8. Save timing to `with_skill/timing.json`:
   ```json
   { "duration_seconds": N, "start_iso": "...", "end_iso": "..." }
   ```
9. Restore git state:
   ```bash
   git checkout -- .
   git clean -fd
   ```

#### 4c: Run WITHOUT Skill

Same as 4b but the agent prompt does NOT include the skill instructions section:

```
You are being evaluated on a coding task.

## Task

{test_case.prompt}

## Context
You are working in a Momentum CMS monorepo (Angular + Nx + Drizzle ORM).

## Rules
- Work in the current repository
- Do NOT read any evals.json files
- Do NOT look at .claude/skill-evals/
- Do NOT read any CLAUDE.md files
- Complete the task to the best of your ability
```

Save results to `without_skill/` subdirectory.

#### 4d: Restore Git Stash

```bash
git stash pop
```

If nothing was stashed, skip this.

### Step 5: Grade Assertions

For each assertion in the test case, evaluate it against the worktree where the agent ran its code (before cleaning up).

#### Assertion Tiers

Every assertion has a `tier` field that determines its purpose:

- **`baseline`** (default if omitted) — "Does it work at all?" These are lenient checks that any competent agent should pass. They use `path_alt` fallbacks and check for fundamental correctness. Both modes (with/without skill) should ideally pass these.

- **`convention`** — "Does it follow our project conventions?" These are STRICT checks with NO fallbacks. They verify the skill taught the agent our specific patterns (file naming, selector prefix, host styling). These are the primary differentiators — with-skill should pass, without-skill probably won't.

- **`quality`** — "Does the output actually work in the project?" These run real commands (`nx lint`, `nx test`, TypeScript compilation). They catch broken imports, type errors, and lint violations that pattern-matching assertions miss.

#### Assertion Types

**`file_exists`**

```json
{ "type": "file_exists", "path": "libs/ui/src/lib/chip/chip.ts", "tier": "convention" }
{ "type": "file_exists", "path": "libs/ui/src/lib/chip/chip.ts", "path_alt": "libs/ui/src/lib/chip/chip.component.ts", "tier": "baseline" }
```

- Without `path_alt`: PASS only if exact path exists.
- With `path_alt`: PASS if EITHER exists. Record which matched.

**`file_contains`**

```json
{
	"type": "file_contains",
	"path": "...",
	"path_alt": "...",
	"patterns": ["OnPush", "mcms-"],
	"tier": "baseline"
}
```

- ALL patterns must appear in the file.
- If `path` doesn't exist but `path_alt` does, check `path_alt` instead.
- PASS only if every pattern found. Record which patterns were missing.

**`file_not_contains`**

```json
{
	"type": "file_not_contains",
	"path": "...",
	"path_alt": "...",
	"patterns": ["standalone: true", ": any"],
	"tier": "baseline"
}
```

- NONE of the patterns should appear.
- If `path` doesn't exist but `path_alt` does, check `path_alt` instead.
- PASS only if no pattern found. Record which patterns were incorrectly present.

**`command_succeeds`**

```json
{ "type": "command_succeeds", "command": "npx nx lint ui", "tier": "quality", "timeout": 60000 }
```

- Run command in the worktree, PASS if exit code is 0.
- Use `timeout` field (default 120000ms) to prevent hangs.
- Record stdout/stderr snippet on failure.
- Common commands: `npx nx lint <project>`, `npx nx test <project>`, `npx tsc --noEmit -p libs/<project>/tsconfig.lib.json`

**`file_matches_glob`**

```json
{
	"type": "file_matches_glob",
	"glob": "libs/ui/src/lib/chip/chip{,.component}.ts",
	"min_count": 1,
	"tier": "baseline"
}
```

- Check that at least `min_count` files match the glob pattern. PASS if count >= min_count.
- Useful when exact path is uncertain but the file should exist somewhere predictable.

#### Grading Output

Save to `grading.json`:

```json
{
	"test_case": "<name>",
	"mode": "with_skill",
	"assertions": [
		{
			"type": "file_exists",
			"path": "...",
			"tier": "convention",
			"pass": true,
			"evidence": "Primary path matched: chip.ts (1.2 KB)"
		},
		{
			"type": "file_exists",
			"path": "...",
			"tier": "baseline",
			"pass": true,
			"evidence": "Primary path matched: chip.ts (1.2 KB)"
		},
		{
			"type": "command_succeeds",
			"command": "npx nx lint ui",
			"tier": "quality",
			"pass": true,
			"evidence": "Exit code 0, no warnings"
		}
	],
	"pass_count": 3,
	"fail_count": 0,
	"total": 3,
	"score": 1.0,
	"by_tier": {
		"baseline": { "pass": 1, "fail": 0, "total": 1 },
		"convention": { "pass": 1, "fail": 0, "total": 1 },
		"quality": { "pass": 1, "fail": 0, "total": 1 }
	}
}
```

### Step 6: Aggregate Benchmark

After all test cases complete, create `benchmark.json` in the iteration directory:

```json
{
  "skill": "<skill-name>",
  "iteration": N,
  "timestamp": "ISO-8601",
  "test_cases": {
    "<test-name>": {
      "with_skill": { "score": 0.90, "duration_seconds": 105, "by_tier": { "baseline": 1.0, "convention": 0.75, "quality": 1.0 } },
      "without_skill": { "score": 0.60, "duration_seconds": 180, "by_tier": { "baseline": 1.0, "convention": 0.0, "quality": 0.50 } }
    }
  },
  "summary": {
    "with_skill": {
      "avg_score": 0.90,
      "avg_duration": 105,
      "total_pass": 9,
      "total_fail": 1,
      "by_tier": { "baseline": { "pass": 4, "fail": 0 }, "convention": { "pass": 3, "fail": 1 }, "quality": { "pass": 2, "fail": 0 } }
    },
    "without_skill": {
      "avg_score": 0.60,
      "avg_duration": 180,
      "total_pass": 6,
      "total_fail": 4,
      "by_tier": { "baseline": { "pass": 4, "fail": 0 }, "convention": { "pass": 0, "fail": 4 }, "quality": { "pass": 2, "fail": 0 } }
    },
    "delta": {
      "score_improvement": 0.30,
      "convention_delta": 0.75,
      "quality_delta": 0.50,
      "duration_change_seconds": -75
    }
  }
}
```

### Step 7: Print Summary

Print a markdown table comparing results with tier breakdown:

```
## Skill Eval Results: <skill-name> (Iteration N)

### Overall
| Test Case        | With Skill | Without Skill | Delta  |
|------------------|-----------|---------------|--------|
| basic-component  | 8/9 (89%) | 5/9 (56%)    | +33%   |
| with-inject      | 7/7 (100%)| 4/7 (57%)    | +43%   |
| **Total**        | **15/16** | **9/16**      | **+38%** |

### By Tier
| Tier       | With Skill | Without Skill | Delta  |
|------------|-----------|---------------|--------|
| Baseline   | 6/6 (100%)| 6/6 (100%)   | 0%     |
| Convention | 5/6 (83%) | 0/6 (0%)     | +83%   |
| Quality    | 4/4 (100%)| 3/4 (75%)    | +25%   |

### Timing
| Test Case        | With Skill | Without Skill | Delta   |
|------------------|-----------|---------------|---------|
| basic-component  | 105s      | 180s          | -75s    |
| with-inject      | 90s       | 150s          | -60s    |
```

The **Convention tier delta** is the primary measure of skill value. If convention assertions pass equally with and without the skill, the skill isn't teaching conventions effectively.

### Step 8: Suggest Improvements

If any assertions consistently fail in "with_skill" mode:

1. Read the failing assertion details from grading.json
2. Read the relevant section of the SKILL.md
3. Suggest specific improvements to the skill instructions

If convention assertions pass in both modes (skill adds no value for conventions), flag this as **outgrowth** — the skill may need stronger convention tests or the base model has learned these patterns.

If quality assertions fail, the generated code has real bugs. Suggest both skill improvements AND eval prompt clarifications.

## Writing Good Evals

When creating or reviewing evals.json, follow these principles:

### The Three-Tier Rule

Every test case should have assertions in ALL three tiers:

1. **Baseline assertions** — lenient, with `path_alt` fallbacks. "Did the agent produce a working component?"
   - file_exists with path_alt
   - file_contains for fundamental patterns (OnPush, selector, inputs)
   - file_not_contains for legacy anti-patterns

2. **Convention assertions** — strict, NO fallbacks. "Did the agent follow our conventions?"
   - file_exists with EXACT path (no path_alt) for naming convention
   - file_contains for project-specific patterns (mcms- prefix, host styling)
   - file_not_contains for patterns that work but violate conventions

3. **Quality assertions** — command-based. "Does it actually compile and pass?"
   - command_succeeds for lint, test, typecheck
   - These catch the things pattern-matching misses

### Prompt Design

- **Don't leak pattern names** — describe BEHAVIOR, not IMPLEMENTATION
  - Bad: "Use the hostClasses computed pattern"
  - Good: "Combine variant, color, and consumer classes on the host element"

- **Don't over-specify** — leave room for the skill to guide implementation
  - Bad: "Use inject(McmsThemeService) and create a computed signal for isDark"
  - Good: "Support dark mode theming"

- **Include enough context** — the prompt should be realistic, not a trick question
  - Always specify: which library, what the component does, what inputs it takes
  - Don't specify: file names, import paths, internal implementation details

### Test Both Positive and Negative

For every positive assertion ("it should have X"), consider a negative counterpart ("it should NOT have Y"). One-sided evals optimize one-sidedly.

### Saturated Evals Become Regression Tests

Once a test case hits 100% pass rate across multiple iterations, it's done. Don't keep running it in improvement loops — move it to a regression suite and write harder tests.

## Important Notes

- **Never modify the skill being evaluated** — this is a read-only evaluation
- **Always use worktree isolation** for subagent runs to avoid corrupting the working tree
- **Never let the subagent see evals.json** — that would let it game the assertions
- **Keep evidence concrete** — "Found pattern at line 12" not "Pattern exists"
- **Run `nx reset` before starting** if you suspect Nx cache might skew results
- **Convention tier is king** — this is what proves the skill has value
