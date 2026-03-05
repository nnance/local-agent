---
name: file-search-grep
description: >
  Search file contents for a text pattern.
  Use when you need to find specific text, code,
  or patterns within files.
scripts:
  - name: grep
    path: scripts/grep.sh
    description: >
      Search for a pattern in files within a directory.
    parameters:
      type: object
      properties:
        pattern:
          type: string
          description: Regular expression pattern to search for
        directory:
          type: string
          description: Directory to search in (defaults to current directory)
      required:
        - pattern
---

# File Search Grep

Searches file contents using grep with regular expression support. Recursively
searches through all files in the specified directory.
