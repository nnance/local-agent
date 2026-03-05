#!/bin/bash
set -euo pipefail

pattern="$1"
directory="${2:-.}"

if [ ! -d "$directory" ]; then
  echo "Error: Directory not found: $directory" >&2
  exit 1
fi

grep -rn --include='*' --exclude-dir='node_modules' --exclude-dir='.git' "$pattern" "$directory" 2>/dev/null || true
