---
name: file-read
description: >
  Read the contents of a file from the local filesystem.
  Use when you need to examine file contents, check
  configuration, or read source code.
scripts:
  - name: read
    path: scripts/read.sh
    description: >
      Read a file at the given path and return its contents.
    parameters:
      type: object
      properties:
        file_path:
          type: string
          description: Absolute path to the file to read
      required:
        - file_path
---

# File Read

Reads a file from the local filesystem and returns its contents to stdout.

## Usage

The script expects an absolute file path as its only argument. It will output the
file contents to stdout. If the file does not exist, it prints an error to stderr
and exits with code 1.
