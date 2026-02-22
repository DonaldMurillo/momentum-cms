#!/bin/bash
# Template: Generate Visual Documentation Index
# Purpose: Scan docs/visuals/ and generate a categorized README.md
# Usage: ./generate-visual-index.sh [visuals-dir]
#
# Outputs:
#   - docs/visuals/README.md: Categorized index of all visual assets
#
# Run this after capturing visual documentation to generate the index.

set -euo pipefail

VISUALS_DIR="${1:-docs/visuals}"
OUTPUT_FILE="$VISUALS_DIR/README.md"

if [[ ! -d "$VISUALS_DIR" ]]; then
    echo "Error: $VISUALS_DIR does not exist"
    exit 1
fi

# Count assets
PNG_COUNT=$(find "$VISUALS_DIR" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
WEBM_COUNT=$(find "$VISUALS_DIR" -name "*.webm" 2>/dev/null | wc -l | tr -d ' ')
GIF_COUNT=$(find "$VISUALS_DIR" -name "*.gif" 2>/dev/null | wc -l | tr -d ' ')
TOTAL=$((PNG_COUNT + WEBM_COUNT + GIF_COUNT))

# Start building the README
cat > "$OUTPUT_FILE" << 'HEADER'
# Visual Documentation

Screenshots, videos, and GIFs documenting Momentum CMS features and flows.

> **Auto-generated** by the `doc-visual` skill. Re-run `/doc-visual all` to update.

HEADER

echo "**Total assets**: $TOTAL ($PNG_COUNT screenshots, $WEBM_COUNT videos, $GIF_COUNT GIFs)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Categories to scan (in display order)
CATEGORIES=(
    "auth:Authentication:Login, setup, and password recovery"
    "dashboard:Dashboard:Admin dashboard overview"
    "collections:Collections:CRUD operations on collections"
    "fields:Field Types:Field type showcase"
    "media:Media Library:File uploads and media management"
    "navigation:Navigation:Sidebar, drawers, and navigation chrome"
    "plugins:Plugins:Analytics, SEO, and other plugin dashboards"
    "theme:Theme:Light and dark mode comparisons"
    "responsive:Responsive:Breakpoint screenshots"
    "kitchen-sink:Kitchen Sink:UI component showcase"
)

for ENTRY in "${CATEGORIES[@]}"; do
    IFS=':' read -r DIR TITLE DESC <<< "$ENTRY"
    CATEGORY_DIR="$VISUALS_DIR/$DIR"

    if [[ ! -d "$CATEGORY_DIR" ]]; then
        continue
    fi

    # Count files in this category
    FILE_COUNT=$(find "$CATEGORY_DIR" -type f \( -name "*.png" -o -name "*.webm" -o -name "*.gif" \) 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$FILE_COUNT" -eq 0 ]]; then
        continue
    fi

    echo "## $TITLE" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "$DESC" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    # List PNGs as inline images
    for PNG in $(find "$CATEGORY_DIR" -name "*.png" -type f 2>/dev/null | sort); do
        FILENAME=$(basename "$PNG")
        REL_PATH="$DIR/$FILENAME"
        ALT_TEXT=$(echo "$FILENAME" | sed 's/\.png$//' | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')
        echo "### $ALT_TEXT" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "![${ALT_TEXT}](${REL_PATH})" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    done

    # List videos as links (WebM doesn't render inline on GitHub)
    for VIDEO in $(find "$CATEGORY_DIR" -name "*.webm" -type f 2>/dev/null | sort); do
        FILENAME=$(basename "$VIDEO")
        REL_PATH="$DIR/$FILENAME"
        ALT_TEXT=$(echo "$FILENAME" | sed 's/\.webm$//' | sed 's/-/ /g')
        echo "- [${ALT_TEXT}](${REL_PATH})" >> "$OUTPUT_FILE"
    done

    # List GIFs as inline images
    for GIF_FILE in $(find "$CATEGORY_DIR" -name "*.gif" -type f 2>/dev/null | sort); do
        FILENAME=$(basename "$GIF_FILE")
        REL_PATH="$DIR/$FILENAME"
        ALT_TEXT=$(echo "$FILENAME" | sed 's/\.gif$//' | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')
        echo "### $ALT_TEXT" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "![${ALT_TEXT}](${REL_PATH})" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    done

    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
done

echo "Generated: $OUTPUT_FILE"
echo "Assets indexed: $TOTAL"
