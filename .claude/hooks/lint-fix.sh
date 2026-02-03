#!/bin/bash
# PostToolUse hook: Auto-lint files after Write/Edit
# Runs nx affected lint with fix on the modified file

# Only run for TypeScript/HTML files
FILE_PATH="$CLAUDE_FILE_PATH"

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.html ]]; then
  # Run nx affected lint with fix (respects Nx project boundaries)
  cd "$CLAUDE_PROJECT_DIR" && nx affected -t lint --fix 2>/dev/null || true
fi
