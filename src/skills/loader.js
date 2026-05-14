// @kard/agent — Skills loader
//
// Skills are .md files. Drop one anywhere the loader scans and the agent
// learns a new capability — a new API to read, a new venue to trade on,
// a new rule to enforce, a new piece of domain knowledge.
//
// Format: YAML frontmatter + Markdown body.
//
//   ---
//   name: coingecko-price
//   description: Fetch live spot prices from CoinGecko free API.
//   triggers: [price, quote, market price, spot]
//   tools:
//     - id: get_price
//       description: Get USD price for a symbol
//       endpoint: GET https://api.coingecko.com/api/v3/simple/price?ids={id}&vs_currencies=usd
//       params:
//         id: coin id (e.g. bitcoin, ethereum)
//   permissions:
//     network: [coingecko.com]
//     reads: true
//     writes: false
//   ---
//
//   # When to use
//   Use this skill whenever the user asks for a spot price …
//
// Scan order (later wins):
//   1. <pkg>/skills/builtin/*/SKILL.md         — bundled
//   2. ./skills/**/SKILL.md                    — project-local (cwd)
//   3. ~/.kard/skills/**/SKILL.md              — user-global
//   4. $KARD_SKILLS_DIR/**/SKILL.md            — explicit override

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const PKG_BUILTIN = path.resolve(__dirname, '../../skills/builtin')
const HOME_DIR = path.join(os.homedir(), '.kard', 'skills')
const CWD_DIR = path.resolve(process.cwd(), 'skills')

export class SkillRegistry {
  constructor () {
    this.skills = new Map() // name → Skill
    this.sources = []
  }

  /** Walk the four standard locations and load every SKILL.md found. */
  loadAll () {
    const dirs = [PKG_BUILTIN, CWD_DIR, HOME_DIR]
    if (process.env.KARD_SKILLS_DIR) dirs.push(process.env.KARD_SKILLS_DIR)
    for (const d of dirs) this._scan(d)
    return this
  }

  _scan (dir) {
    if (!fs.existsSync(dir)) return
    const stack = [dir]
    while (stack.length) {
      const cur = stack.pop()
      let entries
      try { entries = fs.readdirSync(cur, { withFileTypes: true }) }
      catch { continue }
      for (const e of entries) {
        const p = path.join(cur, e.name)
        if (e.isDirectory()) { stack.push(p); continue }
        if (e.isFile() && /SKILL\.md$/i.test(e.name)) {
          try {
            const skill = this._parse(p)
            if (skill?.name) {
              this.skills.set(skill.name, skill)
              this.sources.push({ name: skill.name, path: p })
            }
          } catch (err) {
            console.error(`[kard.skills] failed to load ${p}: ${err.message}`)
          }
        }
      }
    }
  }

  /** Add a skill from a file path (CLI: `kard skill add ./mything.md`) */
  addFromPath (filePath) {
    const skill = this._parse(filePath)
    if (!skill?.name) throw new Error(`No 'name' field in ${filePath}`)
    // Copy into the user-global skills dir for persistence
    if (!fs.existsSync(HOME_DIR)) fs.mkdirSync(HOME_DIR, { recursive: true })
    const dest = path.join(HOME_DIR, skill.name, 'SKILL.md')
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(filePath, dest)
    this.skills.set(skill.name, skill)
    this.sources.push({ name: skill.name, path: dest })
    return skill
  }

  remove (name) {
    const src = this.sources.find(s => s.name === name)
    if (src && src.path.startsWith(HOME_DIR)) {
      try { fs.rmSync(path.dirname(src.path), { recursive: true, force: true }) } catch {}
    }
    this.skills.delete(name)
    this.sources = this.sources.filter(s => s.name !== name)
  }

  list () {
    return [...this.skills.values()]
  }

  /** Hot-reload — watch the standard skill dirs and rescan on change */
  watch (onChange) {
    this._watchers = this._watchers || []
    const dirs = [PKG_BUILTIN, CWD_DIR, HOME_DIR]
    if (process.env.KARD_SKILLS_DIR) dirs.push(process.env.KARD_SKILLS_DIR)
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue
      try {
        const w = fs.watch(dir, { recursive: true, persistent: false }, (event, filename) => {
          if (!filename || !/SKILL\.md$/i.test(filename)) return
          this.skills.clear(); this.sources = []
          this.loadAll()
          onChange?.({ event, filename, dir })
        })
        this._watchers.push(w)
      } catch { /* recursive watch unsupported on some FS */ }
    }
  }
  unwatch () { for (const w of (this._watchers || [])) w.close(); this._watchers = [] }

  get (name) {
    return this.skills.get(name)
  }

  /** Concise text summary the LLM can read in its system prompt */
  describeForPrompt () {
    if (this.skills.size === 0) return ''
    const lines = ['', '=== INSTALLED SKILLS (.md capabilities) ===']
    for (const s of this.skills.values()) {
      lines.push(`• ${s.name} — ${s.description || 'no description'}`)
      if (s.triggers?.length) lines.push(`  triggers: ${s.triggers.join(', ')}`)
      if (s.tools?.length) {
        for (const t of s.tools) lines.push(`  tool: ${t.id} — ${t.description}`)
      }
    }
    lines.push('To invoke a skill, emit an action: { "type": "skill", "name": "<skill-name>", "tool": "<tool-id>", "params": {...} }')
    return lines.join('\n')
  }

  /**
   * Execute a skill tool. Routes by skill.tools[*].kind:
   *   - "http" / unset → fetch the configured endpoint with params
   *   - "js"           → require/import a sibling .js file from the skill dir
   *   - "instruction"  → no-op; the body is for the LLM only
   */
  async invoke (skillName, toolId, params = {}, ctx = {}) {
    const skill = this.skills.get(skillName)
    if (!skill) throw new Error(`Skill not found: ${skillName}`)
    const tool = skill.tools?.find(t => t.id === toolId) || skill.tools?.[0]
    if (!tool) throw new Error(`Skill ${skillName} has no tool ${toolId}`)

    // Permission gate
    if (skill.permissions?.writes && !ctx.allowWrites) {
      throw new Error(`Skill ${skillName}/${toolId} requires writes — pass ctx.allowWrites=true`)
    }

    const kind = tool.kind || (tool.endpoint ? 'http' : tool.script ? 'js' : 'instruction')
    if (kind === 'http') return this._invokeHttp(tool, params, skill)
    if (kind === 'js')   return this._invokeJs(skill, tool, params, ctx)
    return { ok: true, instruction: skill.body }
  }

  async _invokeHttp (tool, params, skill) {
    const [methodRaw, urlRaw] = tool.endpoint.split(/\s+/, 2)
    const method = (urlRaw ? methodRaw : 'GET').toUpperCase()
    const tpl = urlRaw || methodRaw
    const url = tpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(params[k] ?? ''))

    // Allowlist check
    const host = new URL(url).host
    const allow = skill.permissions?.network || []
    if (allow.length && !allow.some(h => host.endsWith(h))) {
      throw new Error(`Skill ${skill.name}: host ${host} not in permissions.network ${JSON.stringify(allow)}`)
    }

    const init = { method, headers: { accept: 'application/json' } }
    if (method !== 'GET' && method !== 'HEAD') {
      init.headers['content-type'] = 'application/json'
      // Body priority:
      //   1. params.body          — explicit override from the caller
      //   2. tool.body            — declared at tool level (static default)
      //   3. tool.params.body     — under params.body (built-in skill style)
      //   4. params               — flat object (everything is body)
      const bodyDefault = tool.body ?? tool.params?.body
      const bodyOverride = params.body
      let body
      if (bodyOverride !== undefined) {
        body = bodyOverride
      } else if (bodyDefault !== undefined) {
        // Merge any caller params on top of the declared default
        body = (typeof bodyDefault === 'object' && !Array.isArray(bodyDefault))
          ? { ...bodyDefault, ...params }
          : bodyDefault
      } else {
        body = params
      }
      init.body = JSON.stringify(body)
    }
    const r = await fetch(url, init)
    const text = await r.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }
    return { ok: r.ok, status: r.status, data }
  }

  async _invokeJs (skill, tool, params, ctx) {
    const dir = path.dirname(this.sources.find(s => s.name === skill.name).path)
    const file = path.resolve(dir, tool.script)
    const mod = await import(file + `?t=${Date.now()}`) // bypass module cache so edits hot-reload
    const fn = mod[tool.export || 'default']
    if (typeof fn !== 'function') throw new Error(`Skill ${skill.name}: ${tool.script} has no export ${tool.export || 'default'}`)
    return fn(params, ctx)
  }

  /** YAML-frontmatter parser — uses the real `yaml` package when installed */
  _parse (filePath) {
    const raw = fs.readFileSync(filePath, 'utf8')
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!m) return { name: path.basename(path.dirname(filePath)), body: raw }
    const fm = parseYamlSync(m[1])
    return { ...fm, body: m[2] || '' }
  }
}

// Real YAML if installed (preferred for anchors/multi-line/quoted edge cases),
// fallback to our minimal parser if the dep isn't around (keeps the package
// usable even without `npm install`).
let _yamlMod = null
let _triedYaml = false
function parseYamlSync (src) {
  if (!_triedYaml) {
    _triedYaml = true
    try { _yamlMod = require('yaml') } catch { _yamlMod = null }
  }
  if (_yamlMod?.parse) {
    try { return _yamlMod.parse(src) || {} }
    catch (e) {
      console.error('[kard.skills] yaml parse error, falling back to minimal:', e.message)
    }
  }
  return parseYaml(src)
}

// Minimal YAML — handles the subset we need (scalars, lists, nested maps).
// Skip strict YAML to avoid a runtime dep. If you write fancy YAML, install
// `yaml` and we'll happily use it.
function parseYaml (src) {
  const root = {}
  const lines = src.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'))
  const stack = [{ indent: -1, obj: root, list: null }]

  for (const line of lines) {
    const indent = line.match(/^\s*/)[0].length
    const trimmed = line.trim()

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const top = stack[stack.length - 1]

    // List item
    if (trimmed.startsWith('- ')) {
      const val = trimmed.slice(2).trim()
      if (!Array.isArray(top.obj)) {
        // promote to list
        const parentKey = top.lastKey
        const parent = top.parent || root
        parent[parentKey] = []
        top.obj = parent[parentKey]
      }
      // map-in-list: "- id: foo"
      const kv = val.match(/^([^:]+):\s*(.*)$/)
      if (kv) {
        const item = {}
        item[kv[1].trim()] = coerce(kv[2])
        top.obj.push(item)
        stack.push({ indent, obj: item, list: top.obj, lastKey: kv[1].trim(), parent: item })
      } else {
        top.obj.push(coerce(val))
      }
      continue
    }

    const kv = trimmed.match(/^([^:]+):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1].trim()
    const rawVal = kv[2]

    if (rawVal === '' || rawVal === null) {
      // Container — children determine type (list vs map)
      const child = {}
      if (Array.isArray(top.obj)) {
        const last = top.obj[top.obj.length - 1]
        if (last && typeof last === 'object') last[key] = child
      } else {
        top.obj[key] = child
      }
      stack.push({ indent, obj: child, lastKey: key, parent: top.obj })
    } else if (rawVal.startsWith('[')) {
      const arr = rawVal.replace(/^\[|\]$/g, '').split(',').map(x => coerce(x.trim())).filter(x => x !== '')
      if (Array.isArray(top.obj)) {
        const last = top.obj[top.obj.length - 1]
        if (last && typeof last === 'object') last[key] = arr
      } else {
        top.obj[key] = arr
      }
    } else {
      if (Array.isArray(top.obj)) {
        const last = top.obj[top.obj.length - 1]
        if (last && typeof last === 'object') last[key] = coerce(rawVal)
      } else {
        top.obj[key] = coerce(rawVal)
        top.lastKey = key
      }
    }
  }
  return root
}

function coerce (v) {
  if (v == null) return v
  const s = String(v).trim()
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'null' || s === '~') return null
  if (/^-?\d+$/.test(s)) return parseInt(s)
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s)
  return s.replace(/^['"]|['"]$/g, '')
}

let _global = null
export function globalRegistry () {
  if (!_global) _global = new SkillRegistry().loadAll()
  return _global
}
