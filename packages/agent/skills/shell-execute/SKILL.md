---
name: shell-execute
description: >
  Execute shell commands on the local system.
  Use when you need to run arbitrary commands,
  install packages, or perform system operations.
scripts:
  - name: exec
    path: scripts/exec.sh
    description: >
      Execute a shell command and return its output.
    parameters:
      type: object
      properties:
        command:
          type: string
          description: The shell command to execute
      required:
        - command
---

# Shell Execute

Executes an arbitrary shell command and captures its output. The command is run
via bash. Both stdout and stderr are captured.
