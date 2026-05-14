// @kard/agent — Skill Marketplace client
//
// Browse / search / install community-published skills. Same shape as the
// strategy registry. Default registry is KARD_REGISTRY_URL (dev fallback);
// any user can run their own registry — it's just an HTTP server.
//
// On publish: the skill .md is uploaded as-is, plus a SHA-256 fingerprint.
// Installs verify the fingerprint on download.
//
// Agent-authored skills (FleetLearner) can call `publish()` autonomously
// when the user has KARD_AUTOPUBLISH_SKILLS=1 — the agent shares what it
// learned with the world. Off by default.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const HOME_DIR = path.join(os.homedir(), '.kard', 'skills')
const REGISTRY = process.env.KARD_REGISTRY_URL || 'https://registry.kard.dev'

export class SkillMarketplace {
  constructor (cfg = {}) {
    this.registryUrl = cfg.registryUrl || REGISTRY
    this.token = cfg.token || process.env.KARD_REGISTRY_TOKEN
  }

  /** Search by keyword */
  async search (query) {
    const r = await fetch(`${this.registryUrl}/skills?q=${encodeURIComponent(query || '')}`)
    if (!r.ok) throw new Error(`marketplace search ${r.status}`)
    return r.json()
  }

  /** Show skill details + ratings */
  async show (ref) {
    const r = await fetch(`${this.registryUrl}/skills/${encodeURIComponent(ref)}`)
    if (!r.ok) throw new Error(`marketplace show ${r.status}`)
    return r.json()
  }

  /** Download + install a skill into ~/.kard/skills/<name>/SKILL.md */
  async install (ref) {
    const meta = await this.show(ref)
    const r = await fetch(`${this.registryUrl}/skills/${encodeURIComponent(ref)}/raw`)
    if (!r.ok) throw new Error(`marketplace download ${r.status}`)
    const md = await r.text()
    const fp = crypto.createHash('sha256').update(md).digest('hex')
    if (meta.sha256 && fp !== meta.sha256) {
      throw new Error('marketplace: SHA mismatch on download')
    }
    const slug = (meta.name || ref.split('/').pop()).replace(/[^\w.-]/g, '_')
    const dir = path.join(HOME_DIR, slug)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'SKILL.md'), md)
    return { name: slug, ref, path: path.join(dir, 'SKILL.md') }
  }

  /** Publish a local SKILL.md to the registry */
  async publish (filePath, { name } = {}) {
    if (!fs.existsSync(filePath)) throw new Error(`no skill at ${filePath}`)
    const md = fs.readFileSync(filePath, 'utf8')
    const sha256 = crypto.createHash('sha256').update(md).digest('hex')
    const r = await fetch(`${this.registryUrl}/skills`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
      },
      body: JSON.stringify({ name, sha256, md })
    })
    if (!r.ok) throw new Error(`publish ${r.status}: ${await r.text()}`)
    return r.json()
  }
}
