#!/usr/bin/env python3
"""
Stop hook that checks if Claude completed quality checks before stopping.
Analyzes the session transcript to verify:
1. If code was written, was code-quality agent run?
2. If tests were written/modified, was test-reviewer agent run?
3. If code was written, was lint/build run?
4. If code was written, were unit tests run?
5. If code was written, ask about e2e tests?

Adapted for Angular/Nx monorepo (Momentum CMS).
"""

import json
import sys


def read_transcript(path: str) -> list[dict]:
    """Read the JSONL transcript file."""
    messages = []
    try:
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    messages.append(json.loads(line))
    except (FileNotFoundError, json.JSONDecodeError):
        return []
    return messages


def is_lib_code(path: str) -> bool:
    """Check if path is source code in /libs/ (not tests)."""
    if '/libs/' not in path:
        return False
    if not path.endswith('.ts'):
        return False
    # Exclude test files
    if '.spec.ts' in path or '.test.ts' in path or '/__tests__/' in path:
        return False
    # Exclude config files
    if 'vitest.config.ts' in path or 'jest.config.ts' in path:
        return False
    return True


def is_app_code(path: str) -> bool:
    """Check if path is source code in /apps/ (not tests)."""
    if '/apps/' not in path:
        return False
    if not path.endswith('.ts'):
        return False
    # Exclude test files
    if '.spec.ts' in path or '.test.ts' in path or '/__tests__/' in path:
        return False
    # Exclude config files
    if 'vitest.config.ts' in path or 'jest.config.ts' in path:
        return False
    return True


def is_test_file(path: str) -> bool:
    """Check if path is a test file."""
    return '.spec.ts' in path or '.test.ts' in path or '/__tests__/' in path


def is_ui_component(path: str) -> bool:
    """Check if path is a UI component (needs accessibility review)."""
    # UI library components
    if '/libs/ui/' in path and path.endswith('.ts'):
        if not is_test_file(path):
            return True
    # Admin components
    if '/libs/admin/src/lib/components/' in path and path.endswith('.ts'):
        if not is_test_file(path):
            return True
    return False


def analyze_session(messages: list[dict]) -> dict:
    """Analyze what happened in the session."""
    result = {
        'wrote_code': False,
        'wrote_tests': False,
        'wrote_ui_component': False,
        'ran_code_quality': False,
        'ran_test_reviewer': False,
        'ran_a11y_auditor': False,
        'ran_lint': False,
        'ran_build': False,
        'ran_unit_tests': False,
        'asked_e2e': False,
    }

    for msg in messages:
        msg_str = json.dumps(msg)

        # Check for Write/Edit tool usage on libs/ or apps/ files
        if '"tool_name"' in msg_str or '"name"' in msg_str:
            if 'Write' in msg_str or 'Edit' in msg_str:
                # Check if it's lib or app code
                if is_lib_code(msg_str) or is_app_code(msg_str):
                    result['wrote_code'] = True
                # Check if it's a UI component
                if is_ui_component(msg_str):
                    result['wrote_ui_component'] = True
                # Check if it's a test file
                if is_test_file(msg_str):
                    result['wrote_tests'] = True

        # Check for Task tool with code-quality agent
        if 'code-quality' in msg_str and 'subagent_type' in msg_str:
            result['ran_code_quality'] = True

        # Check for Task tool with test-reviewer agent
        if 'test-reviewer' in msg_str and 'subagent_type' in msg_str:
            result['ran_test_reviewer'] = True

        # Check for Task tool with a11y-auditor agent
        if 'a11y-auditor' in msg_str and 'subagent_type' in msg_str:
            result['ran_a11y_auditor'] = True

        # Check for lint commands (nx affected -t lint, nx lint)
        if 'nx' in msg_str and 'lint' in msg_str:
            result['ran_lint'] = True

        # Check for build commands (nx affected -t build, nx build)
        if 'nx' in msg_str and 'build' in msg_str:
            result['ran_build'] = True

        # Check for unit test commands (nx test, nx affected -t test, npm run test, vitest)
        if ('nx' in msg_str and 'test' in msg_str) or 'vitest' in msg_str or 'npm run test' in msg_str:
            result['ran_unit_tests'] = True

        # Check if e2e was mentioned/asked about
        if 'e2e' in msg_str.lower():
            result['asked_e2e'] = True

    return result


def main():
    # Read input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # Allow stop if can't parse input

    # Don't block if we're already in a stop hook loop
    if input_data.get('stop_hook_active', False):
        sys.exit(0)

    transcript_path = input_data.get('transcript_path', '')
    if not transcript_path:
        sys.exit(0)

    messages = read_transcript(transcript_path)
    if not messages:
        sys.exit(0)

    analysis = analyze_session(messages)

    # Determine what's missing
    missing = []

    # If code was written, check for code-quality agent (MANDATORY)
    if analysis['wrote_code'] and not analysis['ran_code_quality']:
        missing.append("Run the code-quality agent to check for DRY/KISS/SRP/Angular violations: Task tool with subagent_type='code-quality'")

    # If tests were written/modified, check for test-reviewer agent
    if analysis['wrote_tests'] and not analysis['ran_test_reviewer']:
        missing.append("Run the test-reviewer agent to verify test integrity: Task tool with subagent_type='test-reviewer'")

    # If UI components were modified, check for a11y-auditor (MANDATORY for ADA compliance)
    if analysis['wrote_ui_component'] and not analysis['ran_a11y_auditor']:
        missing.append("Run the a11y-auditor agent for WCAG 2.1 AA / ADA compliance: Task tool with subagent_type='a11y-auditor'")

    # If code was written, check for lint/build verification (MANDATORY)
    if analysis['wrote_code'] and not (analysis['ran_lint'] or analysis['ran_build']):
        missing.append("Run verification: `nx affected -t lint && nx affected -t build`")

    # If code was written, check for unit tests (MANDATORY)
    if analysis['wrote_code'] and not analysis['ran_unit_tests']:
        missing.append("Run unit tests: `nx affected -t test`")

    # If code was written, ask about e2e tests (ASK)
    if analysis['wrote_code'] and not analysis['asked_e2e']:
        missing.append("Consider: Do e2e tests need to be run? (`nx e2e` or relevant e2e project)")

    if missing:
        # Output JSON to block and provide reason
        output = {
            "decision": "block",
            "reason": "Before completing, please:\n- " + "\n- ".join(missing)
        }
        print(json.dumps(output))
        sys.exit(0)

    # All checks passed
    sys.exit(0)


if __name__ == '__main__':
    main()
