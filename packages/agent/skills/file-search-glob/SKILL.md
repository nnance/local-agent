---
name: file-search-glob
description: >
  Find files by name pattern using glob matching.
  Use when you need to locate files by their name,
  extension, or path pattern.
scripts:
  - name: glob
    path: scripts/glob.sh
    description: >
      Search for files matching a glob pattern within a
      directory.
    parameters:
      type: object
      properties:
        pattern:
          type: string
          description: Glob pattern to match files against (e.g. "*.ts", "**/*.json")
        directory:
          type: string
          description: Directory to search in (defaults to current directory)
      required:
        - pattern
---

# File Search Glob

Searches for files matching a glob pattern. Uses the `find` command with name
matching to locate files within the specified directory tree.
