---
name: files
description: >
  Comprehensive file operations including reading, writing, searching by pattern,
  and searching content within files. Use when you need to work with local files.
scripts:
  - name: read
    path: scripts/read.sh
    description: >
      Read the contents of a file from the local filesystem.
      Use when you need to examine file contents, check
      configuration, or read source code.
    parameters:
      type: object
      properties:
        file_path:
          type: string
          description: Absolute path to the file to read
      required:
        - file_path

  - name: write
    path: scripts/write.sh
    description: >
      Create or overwrite files on the local filesystem.
      Use when you need to write content to a file,
      create new files, or update existing ones.
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

  - name: glob
    path: scripts/glob.sh
    description: >
      Find files by name pattern using glob matching.
      Use when you need to locate files by their name,
      extension, or path pattern.
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

  - name: grep
    path: scripts/grep.sh
    description: >
      Search file contents for a text pattern.
      Use when you need to find specific text, code,
      or patterns within files.
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

# Files

Comprehensive file operations for the local filesystem including reading, writing,
searching by pattern, and searching content within files.

## Operations

### Read a file
Reads a file from the local filesystem and returns its contents to stdout.
Use when you need to examine file contents, check configuration, or read source code.

### Write a file
Writes content to a file on the local filesystem. Creates parent directories
as needed and overwrites existing files.

### Find files by pattern (glob)
Searches for files matching a glob pattern. Uses the `find` command with name
matching to locate files within the specified directory tree.

### Search file contents (grep)
Searches file contents using grep with regular expression support. Recursively
searches through all files in the specified directory.

## Usage

Each operation is available as a separate script within this skill. Choose the
appropriate operation based on your needs:

- Use `read` to read file contents
- Use `write` to create or update files
- Use `glob` to find files by name/extension
- Use `grep` to search for text patterns in file contents
