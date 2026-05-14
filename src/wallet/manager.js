// @kard/agent — Wallet Manager
//
// Smooth wallet UX:
//   - first-run auto-create (saves encrypted JSON keystore at ~/.kard/wallet.json)
//   - password unlock (single prompt; cached in-memory for the process lifetime)
//   - import from PRIVATE_KEY / WDK_SEED env if present (no friction for power users)
//   - multi-account (the keystore is an array; default account is index 0)
//   - hardware-wallet hook (KARD_HARDWARE=ledger triggers ledger flow at runtime)
//
// This sits on top of ChainContext: once the wallet is unlocked we hand its
// private key to ChainContext, which wires per-chain signers from there.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'
import { ethers } from 'ethers'
import { KitePassport } from './passport.js'

const KARD_DIR = path.join(os.homedir(), '.kard')
const KEYSTORE = path.join(KARD_DIR, 'wallet.json')

export class WalletManager {
  constructor (opts = {}) {
    this.path = opts.path || KEYSTORE
    this.password = opts.password || process.env.KARD_PASSWORD || null
    this.unlocked = null  // ethers.Wallet (no provider) once unlocked
    this.accounts = []
    this.activeIndex = parseInt(process.env.KARD_ACCOUNT || '0', 10)
  }

  exists () {
    return fs.existsSync(this.path)
  }

  /**
   * Resolve a usable wallet. Priority:
   *  1. KARD_NO_PASSPORT=1      → skip Passport, fall through to local options
   *  2. Kite Passport detected  → use Passport-managed wallet (preferred)
   *                                returns { passport: KitePassport, address }
   *  3. PRIVATE_KEY env         → ephemeral, never persisted
   *  4. WDK_SEED env (mnemonic) → ephemeral, never persisted
   *  5. KARD_HARDWARE=ledger    → hardware path (advisory)
   *  6. ~/.kard/wallet.json     → encrypted keystore
   *  7. (interactive) auto-create + persist (with passport-first prompt)
   *
   * Returns { privateKey?, address, source, passport? }.
   */
  async resolve ({ interactive = process.stdout.isTTY, preferPassport = true } = {}) {
    // 1. Passport — the Kite-aligned default
    if (preferPassport && process.env.KARD_NO_PASSPORT !== '1') {
      const passport = new KitePassport()
      if (passport.isInstalled()) {
        const me = await passport.me()
        if (me?.address) {
          this.passport = passport
          return { address: me.address, source: 'passport', passport, email: me.email }
        }
        if (interactive) {
          console.error('\n[kard] Kite Passport detected but not signed in.')
          console.error('       Run:  kard passport signup <your-email>')
          console.error('       Or:   KARD_NO_PASSPORT=1 to use a local self-hosted wallet.\n')
        }
      } else if (interactive && !process.env.PRIVATE_KEY && !(process.env.KARD_MNEMONIC || process.env.WDK_SEED) && !this.exists()) {
        // First-run, no Passport, no env, no keystore — show the install hint
        console.error(passport.installHint())
        const useLocal = (await this._prompt('Set up local self-hosted wallet instead? [y/N]: ')).toLowerCase()
        if (!/^y/.test(useLocal)) {
          throw new Error('Aborted — install Passport, then re-run.')
        }
      }
    }

    if (process.env.PRIVATE_KEY) {
      const w = new ethers.Wallet(this._normPk(process.env.PRIVATE_KEY))
      return { privateKey: w.privateKey, address: w.address, source: 'env:PRIVATE_KEY' }
    }
    if ((process.env.KARD_MNEMONIC || process.env.WDK_SEED)) {
      const hd = ethers.HDNodeWallet.fromPhrase((process.env.KARD_MNEMONIC || process.env.WDK_SEED), undefined, "m/44'/60'/0'/0/0")
      return { privateKey: hd.privateKey, address: hd.address, source: 'env:WDK_SEED' }
    }
    if (process.env.KARD_HARDWARE) {
      throw new Error('Hardware-wallet mode requested but no signer factory set. ' +
        'Pass an explicit ethers Signer to ChainContext({ signerFactory }).')
    }
    if (this.exists()) {
      const acct = await this.unlock(undefined, { interactive })
      return { privateKey: acct.privateKey, address: acct.address, source: 'keystore' }
    }
    if (!interactive) {
      throw new Error('No wallet configured. Set PRIVATE_KEY, WDK_SEED, install Kite Passport, or run `kard init`.')
    }
    return this.create({ interactive: true })
  }

  /**
   * First-run wallet creation.
   * Generates a fresh key, asks for an unlock password, encrypts to keystore.
   */
  async create ({ interactive = true, password, label = 'default' } = {}) {
    if (!fs.existsSync(KARD_DIR)) fs.mkdirSync(KARD_DIR, { recursive: true })
    const wallet = ethers.Wallet.createRandom()
    const pw = password ?? this.password ?? (interactive
      ? await this._prompt('Set unlock password (used to encrypt your wallet locally): ', { secret: true })
      : null)
    if (!pw) throw new Error('Wallet password required')

    console.error('\n[kard] Encrypting wallet (this takes a few seconds)…')
    const encrypted = await wallet.encrypt(pw)
    const store = this._loadStore()
    store.accounts.push({ label, address: wallet.address, encrypted, created: new Date().toISOString() })
    fs.writeFileSync(this.path, JSON.stringify(store, null, 2), { mode: 0o600 })

    this.password = pw
    this.unlocked = wallet
    this.accounts = store.accounts
    console.error(`\n✓ Wallet created.`)
    console.error(`  Address: ${wallet.address}`)
    console.error(`  Stored : ${this.path}  (mode 0600)`)
    console.error(`  Backup : your seed phrase →`)
    console.error(`           ${wallet.mnemonic.phrase}`)
    console.error(`  WRITE THIS DOWN. Without it, lost password = lost funds.\n`)
    return { privateKey: wallet.privateKey, address: wallet.address, source: 'keystore' }
  }

  /** Unlock the keystore — uses cached password if available, else prompts */
  async unlock (password, { interactive = true, accountIndex = this.activeIndex } = {}) {
    if (this.unlocked) return this.unlocked
    const store = this._loadStore()
    if (!store.accounts.length) throw new Error('No accounts in keystore')
    const acct = store.accounts[accountIndex]
    if (!acct) throw new Error(`No account at index ${accountIndex}`)
    const pw = password ?? this.password ?? (interactive
      ? await this._prompt(`Unlock wallet ${acct.address}: `, { secret: true })
      : null)
    if (!pw) throw new Error('Password required to unlock keystore')
    const wallet = await ethers.Wallet.fromEncryptedJson(acct.encrypted, pw)
    this.unlocked = wallet
    this.password = pw
    return wallet
  }

  /** List accounts (no private material) */
  list () {
    const store = this._loadStore()
    return store.accounts.map((a, i) => ({
      index: i,
      label: a.label,
      address: a.address,
      created: a.created,
      active: i === this.activeIndex
    }))
  }

  /** Add another account to the same keystore (multi-account) */
  async addAccount ({ label, password = this.password } = {}) {
    if (!password) throw new Error('Existing wallet password required to add account')
    const wallet = ethers.Wallet.createRandom()
    const encrypted = await wallet.encrypt(password)
    const store = this._loadStore()
    store.accounts.push({ label: label || `account-${store.accounts.length}`, address: wallet.address, encrypted, created: new Date().toISOString() })
    fs.writeFileSync(this.path, JSON.stringify(store, null, 2), { mode: 0o600 })
    return { address: wallet.address, label }
  }

  /** Import an existing private key into the keystore */
  async import (privateKey, { label = 'imported', password = this.password } = {}) {
    if (!password) throw new Error('Wallet password required to import')
    const wallet = new ethers.Wallet(this._normPk(privateKey))
    const encrypted = await wallet.encrypt(password)
    const store = this._loadStore()
    store.accounts.push({ label, address: wallet.address, encrypted, created: new Date().toISOString(), imported: true })
    fs.writeFileSync(this.path, JSON.stringify(store, null, 2), { mode: 0o600 })
    return { address: wallet.address, label }
  }

  // ─────────── internals ───────────

  _loadStore () {
    if (!fs.existsSync(this.path)) return { version: 1, accounts: [] }
    const raw = JSON.parse(fs.readFileSync(this.path, 'utf8'))
    this.accounts = raw.accounts || []
    return raw
  }

  _normPk (pk) {
    return pk.startsWith('0x') ? pk : `0x${pk}`
  }

  async _prompt (question, { secret = false } = {}) {
    return new Promise(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
      if (secret) {
        // Mask input — write the question, then suppress echo
        process.stderr.write(question)
        const onData = (char) => {
          char = char.toString()
          switch (char) {
            case '\n': case '\r': case '':
              process.stdin.removeListener('data', onData)
              if (process.stdin.isTTY) process.stdin.setRawMode(false)
              process.stdin.pause()
              process.stderr.write('\n')
              break
            default:
              process.stderr.write('*')
          }
        }
        if (process.stdin.isTTY) process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.on('data', onData)
        rl.question('', (answer) => { rl.close(); resolve(answer) })
      } else {
        rl.question(question, (answer) => { rl.close(); resolve(answer) })
      }
    })
  }
}

/** Convenience singleton */
let _global = null
export function defaultWalletManager () {
  if (!_global) _global = new WalletManager()
  return _global
}
