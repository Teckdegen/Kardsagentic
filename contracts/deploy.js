// @kard/agent — KardAttestor deploy script
//
// Usage:
//   node contracts/deploy.js                 # deploys to KiteAI (chainId 2366)
//   CHAIN=arbitrum node contracts/deploy.js  # deploy elsewhere
//
// Requires solc on PATH (npm i -g solc) OR a precompiled
// contracts/KardAttestor.json with { abi, bytecode }.
//
// After deploy, paste the address into your .env:
//   KARD_ATTESTOR_ADDR=0x…

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ethers } from 'ethers'
import { ChainContext } from '../src/chain-context.js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(__dirname, 'KardAttestor.sol')
const CACHE = path.join(__dirname, 'KardAttestor.json')

function compile () {
  if (fs.existsSync(CACHE)) {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  }
  const r = spawnSync('solc', ['--combined-json', 'abi,bin', SRC], { encoding: 'utf8' })
  if (r.status !== 0) {
    throw new Error('solc compile failed. Install solc (npm i -g solc) or precompile to contracts/KardAttestor.json. ' + r.stderr)
  }
  const out = JSON.parse(r.stdout)
  const key = Object.keys(out.contracts).find(k => k.endsWith(':KardAttestor'))
  const c = out.contracts[key]
  const compiled = { abi: typeof c.abi === 'string' ? JSON.parse(c.abi) : c.abi, bytecode: '0x' + c.bin }
  fs.writeFileSync(CACHE, JSON.stringify(compiled, null, 2))
  return compiled
}

async function main () {
  const chain = process.env.CHAIN || 'kiteai'
  const ctx = new ChainContext()
  const signer = ctx.getSigner(chain)
  console.error(`[deploy] target=${chain}  signer=${signer.address}`)

  const { abi, bytecode } = compile()
  const factory = new ethers.ContractFactory(abi, bytecode, signer)
  console.error('[deploy] sending tx…')
  const c = await factory.deploy()
  await c.waitForDeployment()
  const addr = await c.getAddress()

  console.error('\n✓ KardAttestor deployed')
  console.error(`  chain:   ${chain}`)
  console.error(`  address: ${addr}`)
  console.error(`\n→ add to .env:`)
  console.error(`    KARD_ATTESTOR_ADDR=${addr}`)
  console.log(addr)
}

main().catch(e => { console.error(e); process.exit(1) })
