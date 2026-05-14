---
name: shell-exec
description: Run a shell command or script. Use this when the user asks the agent to execute something locally (run a script, check a process, fetch logs, etc.). Always prefer the most specific skill for the task; only use shell-exec when no purpose-built skill fits.
triggers: [run, execute script, shell, terminal, bash, run command]
tools:
  - id: run
    description: Execute a single shell command. Returns stdout, stderr, exit code.
    kind: js
    script: ./impl.js
    export: run
  - id: run_script
    description: Execute a shell script file. Pass the file path under params.path.
    kind: js
    script: ./impl.js
    export: runScript
permissions:
  reads: true
  writes: true
---

# Shell Exec

Lets the agent run terminal commands and scripts on the host.

## Safety

- Every invocation is logged with timestamp, cwd, command, exit code.
- A built-in deny-list blocks destructive primitives:
  `rm -rf /`, `dd`, `mkfs`, `:(){ :|:& };:` (fork bomb), `shutdown`, `reboot`,
  `chmod -R 777 /`, etc.
- Network access is allowed; agents that should be air-gapped should not
  install this skill.
- Per-call timeout: `KARD_SHELL_TIMEOUT_MS` (default 60s).
- Working directory: `KARD_SHELL_CWD` (default `process.cwd()`).
- **Confirmation:** by default, *every* command must be confirmed by the
  user (Y/n prompt). Set `KARD_SHELL_AUTO=1` to disable confirmation.
  Confirmation is bypassed automatically when invoked from a chat-bot
  context flagged with `ctx.allowWrites=true && ctx.fromChat===true` —
  the chat platform is presumed to have its own approval flow.

## Examples

```json
{ "type": "skill", "name": "shell-exec", "tool": "run",
  "params": { "cmd": "ls -la", "cwd": "/tmp" } }

{ "type": "skill", "name": "shell-exec", "tool": "run_script",
  "params": { "path": "./scripts/rebalance.sh" } }
```

The `params.cmd` is passed to your shell verbatim. The skill will reject
any command containing a deny-listed pattern.
