#!/bin/bash
set -euo pipefail

url="$1"

if [ -z "$url" ]; then
  echo "Error: URL is required" >&2
  exit 1
fi

curl -sL --max-time 30 "$url"