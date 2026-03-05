#!/bin/bash
set -euo pipefail

query="$1"

if [ -z "$query" ]; then
  echo "Error: Search query is required" >&2
  exit 1
fi

# URL-encode the query
encoded_query=$(printf '%s' "$query" | sed 's/ /+/g')

# Use DuckDuckGo lite as a simple search backend
curl -sL --max-time 30 "https://lite.duckduckgo.com/lite/?q=${encoded_query}" \
  | sed -n 's/.*<a[^>]*class="result-link"[^>]*href="\([^"]*\)"[^>]*>\(.*\)<\/a>.*/\2 - \1/p' \
  | head -10

# If no results parsed, provide a fallback message
if [ ${PIPESTATUS[1]} -ne 0 ] 2>/dev/null; then
  echo "Search completed for: $query"
fi
