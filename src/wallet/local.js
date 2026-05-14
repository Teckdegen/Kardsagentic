// @kard/agent — Local Wallet
//
// Clean wallet creation — no Passport, no external dependencies.
// Generates an encrypted keystore at ~/.kard/wallet.json
//
// THE FUNDING MODEL (one-chain setup):
//
//   Step 1: kard init → generates wallet → shows ONE address
//   Step 2: User sends to that ONE address on Arbitrum:
//             • 0.005 ETH  (covers gas + auto-bridging to other chains)
//             • USDC       (your trading capital)
//   Step 3: Agent auto-bridges ETH to Base, Optimism, etc. as needed
//   Step 4: Kite AI gas → testnet: free faucet / mainnet: agent earns from profits
//
// That's it. One address. One chain. Agent handles everything else.

import { ethers } from 'ethers'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'

const KARD_DIR  = path.join(os.homedir(), '.kard')
const KEYSTORE  = path.join(KARD_DIR, 'wallet.json')
const ADDR_FILE = path.join(KARD_DIR, 'address.txt')

// ─── LocalWallet ──────────────────────────────────────────────────────────────
export class LocalWallet {
  constructor (opts = {}) {
    this.path = opts.path || KEYSTORE
    this.password = opts.password || process.env.KARD_PASSWORD || null
    this._wallet = null
  }

  // ─── Check ─────────────────────────────────────────────────────────────────

  exists () {
    return fs.existsSync(this.path)
  }

  /** Read address without decrypting (address is stored plaintext alongside keystore) */
  getAddress () {
    if (this._wallet) return this._wallet.address
    try {
      const raw = JSON.parse(fs.readFileSync(this.path, 'utf8'))
      return raw.address ? ethers.getAddress('0x' + raw.address) : null
    } catch { return null }
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  /**
   * Generate a new wallet and save encrypted keystore.
   * @param {string} password — encrypts the keystore
   * @returns {object} { address, mnemonic }
   */
  async create (password) {
    if (!password) throw new Error('Password required to create wallet')
    if (this.exists()) throw new Error(`Wallet already exists at ${this.path}. Use 'kard wallet list' to see it.`)

    // Generate fresh HD wallet
    const wallet = ethers.Wallet.createRandom()
    const encrypted = await wallet.encrypt(password)

    fs.mkdirSync(KARD_DIR, { recursive: true })
    fs.writeFileSync(this.path, encrypted)
    fs.chmodSync(this.path, 0o600) // read/write only by owner

    // Save address plaintext for quick reads (no decryption needed for display)
    fs.writeFileSync(ADDR_FILE, wallet.address)

    this._wallet = wallet
    this.password = password

    return {
      address: wallet.address,
      mnemonic: wallet.mnemonic?.phrase || null
    }
  }

  /**
   * Import from an existing private key or mnemonic
   * @param {string} keyOrMnemonic — hex private key OR 12/24 word mnemonic
   * @param {string} password — encrypts the keystore
   */
  async importFrom (keyOrMnemonic, password) {
    if (!password) throw new Error('Password required')

    let wallet
    if (keyOrMnemonic.startsWith('0x') && keyOrMnemonic.length === 66) {
      // Private key
      wallet = new ethers.Wallet(keyOrMnemonic)
    } else if (keyOrMnemonic.split(' ').length >= 12) {
      // Mnemonic phrase
      wallet = ethers.Wallet.fromPhrase(keyOrMnemonic.trim())
    } else {
      throw new Error('Provide a 0x hex private key or a 12/24-word mnemonic')
    }

    const encrypted = await wallet.encrypt(password)
    fs.mkdirSync(KARD_DIR, { recursive: true })
    fs.writeFileSync(this.path, encrypted)
    fs.chmodSync(this.path, 0o600)
    fs.writeFileSync(ADDR_FILE, wallet.address)

    this._wallet = wallet
    this.password = password

    return { address: wallet.address }
  }

  // ─── Unlock ────────────────────────────────────────────────────────────────

  /**
   * Decrypt and return an ethers Wallet ready for signing.
   * Caches in memory for the process lifetime.
   */
  async unlock (password) {
    if (this._wallet) return this._wallet

    const pw = password || this.password
    if (!pw) {
      if (process.stdout.isTTY) {
        // Interactive prompt
        const pw2 = await promptPassword('Enter wallet password: ')
        return this.unlock(pw2)
      }
      throw new Error('KARD_PASSWORD env var not set and no interactive terminal')
    }

    if (!this.exists()) {
      throw new Error(`No wallet found at ${this.path}. Run 'kard init' to create one.`)
    }

    const encrypted = fs.readFileSync(this.path, 'utf8')
    this._wallet = await ethers.Wallet.fromEncryptedJson(encrypted, pw)
    this.password = pw
    return this._wallet
  }

  /**
   * Get a signer connected to a specific chain RPC
   * @param {string} rpcUrl
   */
  async getSigner (rpcUrl) {
    const wallet = await this.unlock()
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    return wallet.connect(provider)
  }
}

// ─── Init flow ────────────────────────────────────────────────────────────────

/**
 * Full interactive wallet setup — called by `kard init`
 * Prints clear instructions for funding on ONE chain.
 */
export async function runInit () {
  const wallet = new LocalWallet()

  if (wallet.exists()) {
    const addr = wallet.getAddress()
    console.log('\n✅ Wallet already exists.')
    console.log(`   Address: ${addr}`)
    console.log(`   Keystore: ${KEYSTORE}`)
    console.log('\n   If you want to re-generate, delete ~/.kard/wallet.json first.')
    console.log('   To see your balance: kard gas\n')
    return
  }

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║           KARD — Wallet Setup                        ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  // Ask for password
  const password = await promptPassword('Create a wallet password (min 8 chars): ')
  if (password.length < 8) {
    console.error('Password too short. Min 8 characters.')
    process.exit(1)
  }
  const confirm = await promptPassword('Confirm password: ')
  if (password !== confirm) {
    console.error('Passwords do not match.')
    process.exit(1)
  }

  console.log('\n⏳ Generating wallet...')
  const { address, mnemonic } = await wallet.create(password)

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║  ✅ Wallet Created                                   ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log(`║  Address:  ${address}  ║`)
  console.log('╠══════════════════════════════════════════════════════╣')
  if (mnemonic) {
    console.log('║  ⚠️  SAVE YOUR RECOVERY PHRASE — WRITE IT DOWN NOW   ║')
    console.log('╠══════════════════════════════════════════════════════╣')
    const words = mnemonic.split(' ')
    for (let i = 0; i < words.length; i += 4) {
      const line = words.slice(i, i + 4).map((w, j) => `${i + j + 1}. ${w.padEnd(10)}`).join('  ')
      console.log(`║  ${line}  ║`)
    }
  }
  console.log('╚══════════════════════════════════════════════════════╝\n')

  const mode = (process.env.KARD_ENV || 'testnet').toUpperCase()

  // Print funding instructions
  printFundingInstructions(address, mode)

  // Write address to .env hint
  const envPath = path.resolve(process.cwd(), '.env')
  const envHint = `\n# Generated by kard init — ${new Date().toISOString()}\nKARD_PASSWORD=${password}\n`
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envHint)
    console.log(`\n📄 Created .env with KARD_PASSWORD set.`)
    console.log(`   ⚠️  Add .env to your .gitignore — it contains your password.\n`)
  }

  console.log('─────────────────────────────────────────────────────')
  console.log('Next steps:')
  console.log(`  1. Fund the address above (see instructions)`)
  console.log(`  2. kard gas          → verify balances`)
  console.log(`  3. kard opportunities → see live yield`)
  console.log(`  4. kard run --strategy KITE_YIELD`)
  console.log('─────────────────────────────────────────────────────\n')
}

// ─── Funding instructions ─────────────────────────────────────────────────────

export function printFundingInstructions (address, mode = 'TESTNET') {
  const isTestnet = mode.toUpperCase() === 'TESTNET'

  console.log(`\n╔══════════════════════════════════════════════════════╗`)
  console.log(`║  💰 HOW TO FUND YOUR KARD WALLET — ${mode.padEnd(14)}║`)
  console.log(`╠══════════════════════════════════════════════════════╣`)
  console.log(`║  Your address (same on ALL chains):                  ║`)
  console.log(`║  ${address}  ║`)
  console.log(`╠══════════════════════════════════════════════════════╣`)
  console.log(`║                                                      ║`)
  console.log(`║  STEP 1 — Fund ONE chain only (Arbitrum)             ║`)
  console.log(`║  ────────────────────────────────────────────────    ║`)

  if (isTestnet) {
    console.log(`║                                                      ║`)
    console.log(`║  Arbitrum Sepolia ETH (for gas + bridging):          ║`)
    console.log(`║  → https://faucet.quicknode.com/arbitrum/sepolia     ║`)
    console.log(`║    Get at least 0.02 ETH                             ║`)
    console.log(`║                                                      ║`)
    console.log(`║  Sepolia USDC (for Aave yield testing):              ║`)
    console.log(`║  → https://staging.aave.com/faucet/                  ║`)
    console.log(`║    Get 1000+ USDC                                    ║`)
    console.log(`║                                                      ║`)
    console.log(`║  STEP 2 — Get Kite AI gas (for attestations)         ║`)
    console.log(`║  ────────────────────────────────────────────────    ║`)
    console.log(`║  → https://faucet.gokite.ai                          ║`)
    console.log(`║    Get 1 KITE — this is CRITICAL for attestations    ║`)
  } else {
    console.log(`║                                                      ║`)
    console.log(`║  Send to your address on Arbitrum network:           ║`)
    console.log(`║  • 0.005 ETH minimum (~$12)                          ║`)
    console.log(`║    → covers Arbitrum gas + auto-bridging             ║`)
    console.log(`║    → agent will bridge to Base/Optimism as needed    ║`)
    console.log(`║  • USDC (your trading capital)                       ║`)
    console.log(`║    → any amount you want to deploy                   ║`)
    console.log(`║                                                      ║`)
    console.log(`║  How to get ETH on Arbitrum:                         ║`)
    console.log(`║  • Buy on Coinbase, withdraw to "Arbitrum" network   ║`)
    console.log(`║  • Bridge from Ethereum: https://bridge.arbitrum.io  ║`)
    console.log(`║  • Fast bridge: https://across.to                    ║`)
    console.log(`║                                                      ║`)
    console.log(`║  STEP 2 — Get a tiny bit of KITE for attestations    ║`)
    console.log(`║  ────────────────────────────────────────────────    ║`)
    console.log(`║  KITE gas is needed for Kite AI attestations.        ║`)
    console.log(`║  • Ask in Kite Discord for a small amount            ║`)
    console.log(`║  • Or agent earns it from yield over time            ║`)
  }

  console.log(`║                                                      ║`)
  console.log(`║  THAT'S IT. Agent handles everything else:           ║`)
  console.log(`║  ✅ Auto-bridges ETH to Base/Optimism when needed    ║`)
  console.log(`║  ✅ Finds best yield across all chains automatically  ║`)
  console.log(`║  ✅ Attests every action on Kite AI                   ║`)
  console.log(`║                                                      ║`)
  console.log(`╚══════════════════════════════════════════════════════╝\n`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function promptPassword (prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    // Hide input (write nothing for each char)
    const stdout = process.stdout
    rl.stdoutMuted = true
    rl.question(prompt, (answer) => {
      rl.close()
      stdout.write('\n')
      resolve(answer)
    })
    // Override _writeToOutput to hide characters
    rl._writeToOutput = (s) => {
      if (!rl.stdoutMuted) stdout.write(s)
    }
  })
}

/**
 * Quick wallet check for agent startup — fails fast with a clear message
 * if no wallet is configured.
 */
export function requireWallet () {
  // Priority: env PRIVATE_KEY → env KARD_MNEMONIC → local keystore
  if (process.env.PRIVATE_KEY) return 'env'
  if (process.env.KARD_MNEMONIC || process.env.WDK_SEED) return 'mnemonic'

  const wallet = new LocalWallet()
  if (wallet.exists()) return 'keystore'

  console.error(`
╔══════════════════════════════════════════════════════╗
║  ❌ No wallet found                                  ║
╠══════════════════════════════════════════════════════╣
║  Run one of:                                         ║
║                                                      ║
║  kard init          — create a new local wallet      ║
║  kard wallet import — import existing private key    ║
║                                                      ║
║  Or set PRIVATE_KEY in your .env file                ║
╚══════════════════════════════════════════════════════╝
`)
  process.exit(1)
}
