// shell-exec impl — runs a command via the OS shell
//
// Imported dynamically by skills/loader.js when an action emits
//   { type: 'skill', name: 'shell-exec', tool: 'run' | 'run_script', params: ... }
//
// Returns { stdout, stderr, exitCode, durationMs, command, cwd }

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

// Patterns that get refused outright. Add to KARD_SHELL_DENY (regex, |-separated).
const DEFAULT_DENY = [
  /\brm\s+-rf\s+\/(?!\w)/i,
  /\bdd\s+if=/i,
  /\bmkfs(\.|\s)/i,
  /:\s*\(\s*\)\s*\{[^}]*\}\s*;\s*:/, // fork bomb
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bchmod\s+-R\s+777\s+\//i,
  />\s*\/dev\/sd[a-z]/i,
  /\bcurl[^|]*\|\s*(bash|sh)\b/i        // refuse curl-pipe-bash unless explicit override
]

function deny () {
  if (!process.env.KARD_SHELL_DENY) return DEFAULT_DENY
  return DEFAULT_DENY.concat(
    process.env.KARD_SHELL_DENY.split('|').map(p => new RegExp(p))
  )
}

function isAllowed (cmd) {
  for (const re of deny()) if (re.test(cmd)) return { ok: false, rule: re.source }
  return { ok: true }
}

async function confirm (question) {
  if (process.env.KARD_SHELL_AUTO === '1') return true
  if (!process.stdin.isTTY) return false
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
    rl.question(question, ans => { rl.close(); resolve(/^y/i.test(ans.trim())) })
  })
}

async function execute (cmd, cwd) {
  const start = Date.now()
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
  const args = process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd]
  const timeoutMs = parseInt(process.env.KARD_SHELL_TIMEOUT_MS || '60000', 10)

  return new Promise((resolve, reject) => {
    const proc = spawn(shell, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', killed = false
    proc.stdout.on('data', d => { stdout += d })
    proc.stderr.on('data', d => { stderr += d })
    proc.on('error', reject)
    const t = setTimeout(() => { killed = true; proc.kill('SIGTERM') }, timeoutMs)
    proc.on('close', exitCode => {
      clearTimeout(t)
      resolve({
        stdout: stdout.slice(0, 100_000),
        stderr: stderr.slice(0, 100_000),
        exitCode,
        timedOut: killed,
        durationMs: Date.now() - start,
        command: cmd,
        cwd
      })
    })
  })
}

export async function run (params, ctx = {}) {
  const cmd = params.cmd
  if (!cmd || typeof cmd !== 'string') throw new Error('shell-exec: params.cmd (string) required')
  const allowed = isAllowed(cmd)
  if (!allowed.ok) {
    return { rejected: true, reason: 'deny-list match', rule: allowed.rule }
  }
  const cwd = params.cwd || process.env.KARD_SHELL_CWD || process.cwd()
  const fromChat = ctx.fromChat && ctx.allowWrites
  if (!fromChat) {
    const ok = await confirm(`\n[shell-exec] Run: \`${cmd}\` (cwd=${cwd}) ? [y/N] `)
    if (!ok) return { rejected: true, reason: 'user declined' }
  }
  const result = await execute(cmd, cwd)
  console.error(`[shell-exec] ${cmd} → exit ${result.exitCode} in ${result.durationMs}ms`)
  return result
}

export async function runScript (params, ctx = {}) {
  const filePath = params.path
  if (!filePath) throw new Error('shell-exec: params.path required')
  if (!fs.existsSync(filePath)) throw new Error(`shell-exec: script not found: ${filePath}`)
  const cwd = params.cwd || path.dirname(path.resolve(filePath))
  const cmd = process.platform === 'win32'
    ? `"${filePath}" ${(params.args || []).join(' ')}`
    : `"${filePath}" ${(params.args || []).join(' ')}`
  return run({ cmd, cwd }, ctx)
}

export default run
