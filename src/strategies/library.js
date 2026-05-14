// @kard/agent — Strategy Library
//
// A strategy is a JSON config object. The library lets users:
//   - publish    → push to a remote registry (KARD_REGISTRY_URL)
//   - install    → pull a published strategy into ~/.kard/strategies/
//   - list       → show all installed strategies
//   - save       → save the current LLM-derived strategy as a named preset
//                  ("save this as my 'momentum-conservative' strategy")
//
// On agent boot, the StrategyRegistry merges:
//   1. built-in presets (src/agent/strategies.js)
//   2. ~/.kard/strategies/*.json (user-saved + installed)
//   3. ./strategies/*.json (project-local)
//
// First match wins, later sources can override.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { STRATEGIES as BUILTIN } from '../agent/strategies.js'

const HOME_DIR = path.join(os.homedir(), '.kard', 'strategies')
const CWD_DIR  = path.resolve(process.cwd(), 'strategies')
const REGISTRY = process.env.KARD_REGISTRY_URL || 'https://registry.kard.dev'

export class StrategyRegistry {
  constructor () {
    this.strategies = new Map()
    this.sources = new Map()    // name → 'builtin' | 'user' | 'project'
    this._watchers = []
    this.loadAll()
  }

  loadAll () {
    this.strategies.clear()
    this.sources.clear()
    for (const [name, cfg] of Object.entries(BUILTIN)) {
      this.strategies.set(name, cfg)
      this.sources.set(name, 'builtin')
    }
    this._loadDir(HOME_DIR, 'user')
    this._loadDir(CWD_DIR, 'project')
  }

  _loadDir (dir, kind) {
    if (!fs.existsSync(dir)) return
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
        const name = cfg.name || path.basename(f, '.json')
        this.strategies.set(name.toUpperCase(), cfg)
        this.sources.set(name.toUpperCase(), kind)
      } catch (e) {
        console.error(`[strategies] bad ${f}: ${e.message}`)
      }
    }
  }

  /** Hot-reload — calls onChange whenever any strategy file is added/edited */
  watch (onChange) {
    for (const dir of [HOME_DIR, CWD_DIR]) {
      if (!fs.existsSync(dir)) continue
      try {
        const w = fs.watch(dir, { persistent: false }, (event, filename) => {
          if (!filename || !filename.endsWith('.json')) return
          this.loadAll()
          onChange?.({ event, filename, dir })
        })
        this._watchers.push(w)
      } catch { /* watch unsupported on some FS — skip */ }
    }
  }

  unwatch () { for (const w of this._watchers) w.close(); this._watchers = [] }

  list () {
    return [...this.strategies.entries()].map(([name, cfg]) => ({
      name, source: this.sources.get(name), description: cfg.description || cfg.name
    }))
  }

  get (name) { return this.strategies.get(name?.toUpperCase()) }

  /** Save the current decision/strategy as a named preset */
  saveAs (name, config) {
    if (!fs.existsSync(HOME_DIR)) fs.mkdirSync(HOME_DIR, { recursive: true })
    const slug = name.toUpperCase().replace(/\s+/g, '_')
    const file = path.join(HOME_DIR, slug + '.json')
    const out = { name: slug, ...config, savedAt: new Date().toISOString() }
    fs.writeFileSync(file, JSON.stringify(out, null, 2))
    this.strategies.set(slug, out)
    this.sources.set(slug, 'user')
    return { name: slug, path: file }
  }

  remove (name) {
    const slug = name.toUpperCase()
    const file = path.join(HOME_DIR, slug + '.json')
    if (fs.existsSync(file)) fs.unlinkSync(file)
    this.strategies.delete(slug)
    this.sources.delete(slug)
  }

  // ─── Remote registry ───

  /** Publish a strategy to the registry */
  async publish (filePath, { token = process.env.KARD_REGISTRY_TOKEN } = {}) {
    const cfg = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const r = await fetch(`${REGISTRY}/strategies`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(cfg)
    })
    if (!r.ok) throw new Error(`publish ${r.status}: ${await r.text()}`)
    return r.json()
  }

  /** Install a strategy from `<author>/<slug>` */
  async install (ref) {
    const url = `${REGISTRY}/strategies/${encodeURIComponent(ref)}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`install ${r.status}: ${await r.text()}`)
    const cfg = await r.json()
    if (!fs.existsSync(HOME_DIR)) fs.mkdirSync(HOME_DIR, { recursive: true })
    const slug = (cfg.name || ref.split('/').pop()).toUpperCase().replace(/\s+/g, '_')
    const file = path.join(HOME_DIR, slug + '.json')
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2))
    this.strategies.set(slug, cfg)
    this.sources.set(slug, 'user')
    return { name: slug, path: file, ref }
  }

  /** Search the remote registry */
  async search (query) {
    const r = await fetch(`${REGISTRY}/strategies?q=${encodeURIComponent(query || '')}`)
    if (!r.ok) throw new Error(`search ${r.status}`)
    return r.json()
  }
}

let _global = null
export function strategyRegistry () {
  if (!_global) _global = new StrategyRegistry()
  return _global
}
