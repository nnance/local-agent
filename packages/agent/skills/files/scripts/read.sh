#!/bin/bash
set -euo pipefail

file_path="$1"

if [ ! -f "$file_path" ]; then
  echo "Error: File not found: $file_path" >&2
  exit 1
fi

cat "$file_path"