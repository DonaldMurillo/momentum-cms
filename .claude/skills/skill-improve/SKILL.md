---
name: skill-improve
description: Self-improving skill loop. Analyzes eval failures, rewrites the skill, re-evaluates, and repeats until convergence. Run after /skill-eval produces baseline results.
argument-hint: <skill-name> [--max-rounds N] [--min-delta N] [--fix-evals]
allowed-tools: Bash(*), Read, Glob, Grep, Write, Edit, Agent, Skill
---

# Self-Improving Skill Loop

Analyze eval failures for a skill, rewrite the skill instructions to fix them, re-evaluate, and repeat until the skill converges on a high score.

## Arguments

- First argument: skill name (must match a directory in `.claude/skills/`)
- `--max-rounds N`: maximum improvement rounds (default: 3)
- `--min-delta N`: stop if score improvement is less than this percentage (default: 10)
- `--fix-evals`: also fix flawed assertions AND enrich with missing tiers (default: off)
- `--skip-baseline`: skip running a fresh baseline eval if recent results exist

## Prerequisites

- The skill MUST have `evals/evals.json` with test cases
- There SHOULD be at least one completed iteration in `.claude/skill-evals/$SKILL-workspace/` from a previous `/skill-eval` run. If none exist, run `/skill-eval $SKILL` first to establish a baseline.

## Workflow

### Phase 1: Load Baseline

1. Read the latest `benchmark.json` from `.claude/skill-evals/$SKILL-workspace/iteration-*/`
2. Read all `grading.json` files from the latest iteration's `with_skill/` directories
3. Read the current `.claude/skills/$SKILL/SKILL.md`
4. Read `.claude/skills/$SKILL/evals/evals.json`

If no baseline exists and `--skip-baseline` is not set, run `/skill-eval $SKILL` first.

### Phase 2: Analyze Failures

Build a structured failure report from the with_skill grading results:

```json
{
	"skill": "<name>",
	"baseline_score": 0.81,
	"by_tier": {
		"baseline": { "pass": 6, "fail": 0, "score": 1.0 },
		"convention": { "pass": 2, "fail": 2, "score": 0.5 },
		"quality": { "pass": 2, "fail": 0, "score": 1.0 }
	},
	"failures": [
		{
			"test_case": "admin-component-with-inject",
			"assertion": { "type": "file_exists", "path": "...user-avatar.ts", "tier": "convention" },
			"pass": false,
			"evidence": "File not found. Agent created user-avatar.component.ts instead.",
			"category": "skill_bug",
			"suggested_skill_fix": "Strengthen file naming convention section"
		}
	],
	"missing_tiers": [
		{
			"test_case": "basic-ui-component",
			"missing": ["quality"],
			"suggestion": "Add command_succeeds assertions for nx lint and nx test"
		}
	],
	"outgrowth": [
		{
			"assertion": "file_contains [OnPush, inject, McmsThemeService]",
			"tier": "baseline",
			"test_case": "admin-component-with-inject",
			"reason": "Passes both with and without skill — the prompt gives enough context."
		}
	]
}
```

**Categorize each failure as:**

- `skill_bug` — The skill doesn't teach this well enough. Fix the skill.
- `eval_bug` — The assertion is wrong or too brittle. Fix the eval (only if `--fix-evals`).
- `prompt_leak` — The test prompt gives away the answer. Fix the eval prompt (only if `--fix-evals`).
- `outgrowth` — Both modes pass equally. Note for potential skill pruning.

**Also detect:**

- `missing_tier` — A test case lacks assertions in one or more tiers (baseline/convention/quality). Flag for enrichment (only if `--fix-evals`).

### Phase 3: Fix and Enrich Evals (if `--fix-evals`)

Before touching the skill, fix flawed assertions AND add missing tier coverage.

#### Fix Existing Assertions

**For `eval_bug` (brittle assertions):**

- `file_exists` with exact path that doesn't match real convention → add `path_alt` and set `tier: "baseline"`, then add a SEPARATE strict assertion with no `path_alt` at `tier: "convention"`
- `file_contains` with pattern too specific → relax pattern

**For `prompt_leak` (prompt gives away the answer):**

- Rewrite the test prompt to describe _desired behavior_ without naming the _implementation pattern_
- Example: "Use the hostClasses computed pattern" → "Support variant styling that combines base, variant, and consumer classes on the host element"

#### Add Missing Tier Assertions

For each test case, ensure all three tiers are covered:

**Missing `baseline` tier?** Add:

- `file_exists` with `path_alt` for the main output files
- `file_contains` for fundamental patterns the prompt explicitly requests
- `file_not_contains` for legacy anti-patterns (standalone: true, @Input(), `: any`)

**Missing `convention` tier?** Add:

- `file_exists` with EXACT path (no `path_alt`) for naming convention — this is the key differentiator
- `file_contains` for project-specific patterns the skill teaches (mcms- prefix, host styling, specific import paths)
- Patterns that match the skill's conventions but aren't in the prompt

**Missing `quality` tier?** Add:

- `command_succeeds` for `npx nx lint <project>` — catches import errors, unused vars, ESLint violations
- `command_succeeds` for `npx nx test <project>` — catches broken tests (only if the skill is expected to create tests)
- `command_succeeds` for `npx tsc --noEmit -p <tsconfig>` — catches type errors

**Guidelines for command_succeeds:**

- Use the actual project name from the Nx workspace (e.g., `ui`, `admin`, `e2e-tests`)
- Set `timeout: 120000` for test commands, `timeout: 60000` for lint
- Only add test commands if the skill explicitly creates test files
- Lint and typecheck are always safe to add

#### Rules for Eval Fixes

- NEVER remove assertions, only fix or add
- NEVER make assertions easier to pass — make them more accurate
- When splitting a brittle assertion, create TWO: a lenient baseline + a strict convention
- Keep the original intent of each assertion
- Add a `"_changelog"` entry to evals.json documenting what changed and why
- Increment the `"version"` field

Save the updated `evals.json` and note what changed.

### Phase 4: Rewrite Skill (Improvement Round)

Launch an Agent (subagent_type: "general-purpose") with this meta-prompt:

```
You are a skill optimization expert. Your job is to improve a coding skill definition based on evaluation failures.

## Current Skill
<skill>
{full content of SKILL.md, including frontmatter}
</skill>

## Failure Report
<failures>
{structured failure report from Phase 2, focusing on skill_bug failures}
</failures>

## Current Eval Assertions (for reference only — do NOT optimize for these specifically)
<assertions>
{summary of assertion types and what they check by tier, WITHOUT the exact patterns}
</assertions>

## Rules for Rewriting

1. **Fix failures generically** — If agents produce `.component.ts` files, don't add "never use .component.ts". Instead, strengthen the file naming convention section with clear examples and emphasis.

2. **Don't overfit** — You are shown assertion summaries, NOT exact patterns. Your fixes should teach correct behavior, not game specific checks.

3. **Preserve passing behavior** — Do NOT remove or weaken any instruction that corresponds to passing assertions. Only add/strengthen.

4. **Keep the same structure** — Same headings, same ordering. Insert fixes into the appropriate existing section rather than appending a "fixes" section.

5. **Be specific and concrete** — "Use OnPush" is weak. "Always set changeDetection: ChangeDetectionStrategy.OnPush — never use Default" is strong.

6. **Add examples for common mistakes** — If agents keep making the same error, add a "Do / Don't" example in the relevant section.

7. **Keep it concise** — Every line should earn its place. Don't add redundant rules. Don't add commentary.

8. **Preserve the frontmatter exactly** — Do not change name, description, argument-hint, or allowed-tools.

## Output

Output the COMPLETE updated SKILL.md file. Do not output a diff — output the full file content.
Include a brief section at the end as an HTML comment (<!-- -->) listing what changed and why, so we can track the evolution.
```

**IMPORTANT**: The assertions summary given to the rewriter should describe _what is being checked_ in natural language, NOT the exact regex patterns. Group by tier:

- "**Baseline**: Checks that a component file exists (flexible naming), uses OnPush, has signal inputs"
- "**Convention**: Checks exact file path follows .ts naming, uses mcms- prefix, has host styling"
- "**Quality**: Runs nx lint and nx test to verify the code compiles and passes"

This prevents overfitting to specific assertion strings.

### Phase 5: Save and Version

1. Before overwriting, copy the current SKILL.md to `.claude/skill-evals/$SKILL-workspace/skill-versions/v$N.md` (where N is the round number starting from 0 for the original)
2. Write the new SKILL.md to `.claude/skills/$SKILL/SKILL.md`
3. Save the failure report to `.claude/skill-evals/$SKILL-workspace/improvement-rounds/round-$N/failure-report.json`
4. Save the rewriter's changelog to `.claude/skill-evals/$SKILL-workspace/improvement-rounds/round-$N/changes.md`

### Phase 6: Re-evaluate

Run the eval again using the Skill tool:

```
/skill-eval $SKILL
```

This creates a new iteration in the eval workspace. The eval runner handles worktree isolation, grading, and benchmarking.

### Phase 7: Compare and Decide

After the eval completes, read the new benchmark.json and compare to the previous round:

```
Round 0 (baseline):  81% overall | convention: 50% | quality: 100%
Round 1:             92% overall | convention: 75% | quality: 100% → +11% overall, +25% convention
```

**Primary metric is convention tier score.** Overall score can be misleading when baseline assertions are trivially easy.

**Continue if:**

- Convention score improved by >= `--min-delta` percentage points
- Convention score is not yet 100%
- Round number < `--max-rounds`

**Stop if:**

- Convention score hit 100% (conventions fully taught — we're done)
- Convention improvement < `--min-delta` (diminishing returns)
- Max rounds reached
- Score regressed (revert to previous version!)

### Phase 8: Handle Regression

If a round's score is LOWER than the previous round:

1. **Revert immediately** — Restore the previous SKILL.md from the version archive
2. Log the regression in `improvement-rounds/round-$N/regression.json`:
   ```json
   {
     "round": N,
     "previous_score": 0.92,
     "regressed_score": 0.83,
     "previous_convention": 0.75,
     "regressed_convention": 0.50,
     "reverted_to": "v{N-1}",
     "likely_cause": "Overwrote a working instruction while fixing a different issue"
   }
   ```
3. Stop the loop — don't try to recover automatically

### Phase 9: Final Summary

Print a markdown summary of the entire improvement session:

```markdown
## Skill Improvement: <skill-name>

### Score Progression

| Round        | Overall | Baseline | Convention | Quality | Duration |
| ------------ | ------- | -------- | ---------- | ------- | -------- |
| 0 (baseline) | 81%     | 100%     | 50%        | 100%    | 211s avg |
| 1            | 92%     | 100%     | 75%        | 100%    | 150s avg |
| 2            | 100%    | 100%     | 100%       | 100%    | 120s avg |

### Changes Applied

- **Round 1**: Strengthened file naming convention with Do/Don't table
- **Round 2**: Added explicit barrel export path instruction

### Eval Fixes (if --fix-evals was used)

- Split file_exists into baseline (with path_alt) + convention (strict) assertions
- Added command_succeeds for nx lint and nx test (quality tier)
- Rewrote variants prompt to not leak pattern name

### Remaining Failures

- None (100% pass rate achieved)

### Outgrowth Warnings

- `file_contains [OnPush, inject, McmsThemeService]` in admin-component-with-inject passes without the skill. Baseline tier — expected behavior.
```

### Phase 10: Cleanup

1. Verify the final SKILL.md is saved
2. Verify all version archives exist
3. Print the path to the improvement session: `.claude/skill-evals/$SKILL-workspace/improvement-rounds/`

## Important Notes

- **Separate from /skill-eval** — This skill MUTATES the target skill. `/skill-eval` is read-only measurement.
- **Version everything** — Every SKILL.md version is archived before overwriting. You can always roll back.
- **Revert on regression** — Never push through a regression. Revert and stop.
- **Don't overfit to assertions** — The rewriter sees assertion descriptions, not exact patterns.
- **Convention tier is the primary metric** — Overall score is nice, but convention delta proves the skill has value.
- **Three-tier coverage is mandatory** — When `--fix-evals` is on, every test case must have baseline + convention + quality assertions before the improvement loop starts.
- **Human review recommended** — After the loop completes, review the diff between v0 (original) and the final version.
