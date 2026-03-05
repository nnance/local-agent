---
name: file-write
description: >
  Create or overwrite files on the local filesystem.
  Use when you need to write content to a file,
  create new files, or update existing ones.
scripts:
  - name: write
    path: scripts/write.sh
    description: >
      Write content to a file at the given path. Creates
      parent directories if they do not exist.
    parameters:
      type: object
      properties:
        file_path:
          type: string
          description: Absolute path to the file to write
        content:
          type: string
          description: Content to write to the file
      required:
        - file_path
        - content
---

# File Write

Writes content to a file on the local filesystem. Creates parent directories
as needed and overwrites existing files.
