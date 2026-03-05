#!/bin/bash
set -euo pipefail

file_path="$1"
content="$2"

# Create parent directories if needed
mkdir -p "$(dirname "$file_path")"

printf '%s' "$content" > "$file_path"

echo "Wrote $(printf '%s' "$content" | wc -c | tr -d ' ') bytes to $file_path"
