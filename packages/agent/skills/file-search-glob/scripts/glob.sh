#!/bin/bash
set -euo pipefail

pattern="$1"
directory="${2:-.}"

if [ ! -d "$directory" ]; then
  echo "Error: Directory not found: $directory" >&2
  exit 1
fi

find "$directory" -name "$pattern" -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | sort
