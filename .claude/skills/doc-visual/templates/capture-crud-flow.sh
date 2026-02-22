#!/bin/bash
# Template: Collection CRUD Flow Capture
# Purpose: Capture list, create, view, and edit pages for a collection
# Usage: ./capture-crud-flow.sh <collection-slug> <output-dir>
#
# Outputs:
#   - list-light.png: Collection list view
#   - create-light.png: Create new document form
#   - (Optional) view-light.png: Document view (requires existing data)
#   - (Optional) edit-light.png: Document edit (requires existing data)
#
# Requires: agent-browser, auth state at docs/visuals/.auth-state.json
# Requires: Dev server running at localhost:4200

set -euo pipefail

SLUG="${1:?Usage: $0 <collection-slug> <output-dir>}"
OUTPUT_DIR="${2:?Provide output directory}"
BASE_URL="http://localhost:4200/admin/collections"

mkdir -p "$OUTPUT_DIR"

# Load auth state if available
AUTH_STATE="docs/visuals/.auth-state.json"
if [[ -f "$AUTH_STATE" ]]; then
    echo "Loading auth state..."
    agent-browser state load "$AUTH_STATE"
fi

# Set desktop viewport
agent-browser set viewport 1280 800

# --- Collection List ---
echo "Capturing: Collection list ($SLUG)"
agent-browser open "$BASE_URL/$SLUG"
agent-browser wait --load networkidle
agent-browser wait 500
agent-browser screenshot "$OUTPUT_DIR/list-light.png"

# --- Create New Document ---
echo "Capturing: Create form ($SLUG)"
agent-browser open "$BASE_URL/$SLUG/new"
agent-browser wait --load networkidle
agent-browser wait 500
agent-browser screenshot "$OUTPUT_DIR/create-light.png"

# --- Full page create form (captures all fields) ---
echo "Capturing: Full create form ($SLUG)"
agent-browser screenshot --full "$OUTPUT_DIR/create-full-light.png"

# --- Try to capture view/edit of first document ---
echo "Attempting: Navigate to first document..."
agent-browser open "$BASE_URL/$SLUG"
agent-browser wait --load networkidle
agent-browser snapshot -i

# Try clicking the first document row
# This is best-effort: if no documents exist, these captures are skipped
echo "Note: View and edit captures require existing documents."
echo "If the collection is empty, create a document first or skip these."
echo ""
echo "To capture view/edit manually:"
echo "  agent-browser open \"$BASE_URL/$SLUG/<id>\""
echo "  agent-browser screenshot \"$OUTPUT_DIR/view-light.png\""
echo "  agent-browser open \"$BASE_URL/$SLUG/<id>/edit\""
echo "  agent-browser screenshot \"$OUTPUT_DIR/edit-light.png\""

echo ""
echo "Captured:"
echo "  $OUTPUT_DIR/list-light.png"
echo "  $OUTPUT_DIR/create-light.png"
echo "  $OUTPUT_DIR/create-full-light.png"
