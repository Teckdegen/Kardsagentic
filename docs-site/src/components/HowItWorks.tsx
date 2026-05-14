import { motion } from 'motion/react'

export default function HowItWorks () {
  return (
    <section id="how-it-works" className="max-w-[1200px] mx-auto mt-32 px-6 md:px-12 scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto mb-12"
      >
        <h2 className="text-[36px] md:text-[48px] font-bold tracking-tight leading-[1.05] text-white">
          How every cycle runs
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-slate-400 max-w-xl mx-auto">
          Intelligence proposes. Infrastructure executes. Kite verifies.
        </p>
      </motion.div>

      {/* Terminal-style pipeline visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6 }}
        className="terminal max-w-3xl mx-auto"
      >
        <div className="terminal-header">
          <div className="terminal-dot bg-[#ff5f57]" />
          <div className="terminal-dot bg-[#febc2e]" />
          <div className="terminal-dot bg-[#28c840]" />
          <span className="ml-3 text-[11px] text-slate-500 font-mono">kard run --strategy KITE_YIELD --interval 60s</span>
        </div>
        <div className="terminal-body text-left space-y-1">
          <div className="text-slate-500">{'═'.repeat(60)}</div>
          <div className="text-white font-medium">Cycle #47 START</div>
          <div className="text-slate-500">{'─'.repeat(60)}</div>
          <div className="h-2" />

          <div className="text-blue-400">┌ <span className="text-slate-300">01 OBSERVE</span></div>
          <div className="text-slate-500">│  Reading on-chain state across 5 chains...</div>
          <div className="text-slate-500">│  Balances: USDC 1,200 | ETH 0.045 | Supplied: USDC 800 (Aave)</div>
          <div className="text-blue-400">└ <span className="text-emerald-400">done</span> <span className="text-slate-600">420ms</span></div>
          <div className="h-1" />

          <div className="text-purple-400">┌ <span className="text-slate-300">02 REASON</span> <span className="text-slate-600">(Claude Haiku)</span></div>
          <div className="text-slate-500">│  "Lucid L-USDC 7.2% vs Aave 5.8%. Edge 1.4% on $400 idle."</div>
          <div className="text-slate-500">│  Proposed: lucid_mint 400 USDC → Kite AI (confidence: 0.89)</div>
          <div className="text-purple-400">└ <span className="text-emerald-400">done</span> <span className="text-slate-600">1.3s</span></div>
          <div className="h-1" />

          <div className="text-amber-400">┌ <span className="text-slate-300">03 VALIDATE</span></div>
          <div className="text-slate-500">│  gas_reserve ✓  balance_check ✓  confidence ✓  leverage ✓</div>
          <div className="text-slate-500">│  position_size ✓  health_factor ✓  cooldown ✓  drawdown ✓</div>
          <div className="text-slate-500">│  simulator ✓  policy ✓</div>
          <div className="text-amber-400">└ <span className="text-emerald-400">10/10 passed</span></div>
          <div className="h-1" />

          <div className="text-cyan-400">┌ <span className="text-slate-300">04 EXECUTE</span></div>
          <div className="text-slate-500">│  Minting 400 USDC → L-USDC via Lucid (Arbitrum → Kite AI)</div>
          <div className="text-slate-500">│  tx: 0x4a7f2e...c8d1 <span className="text-emerald-400">confirmed</span></div>
          <div className="text-cyan-400">└ <span className="text-emerald-400">done</span> <span className="text-slate-600">2.1s</span></div>
          <div className="h-1" />

          <div className="text-emerald-400">┌ <span className="text-slate-300">05 ATTEST</span> <span className="text-slate-600">(Kite AI)</span></div>
          <div className="text-slate-500">│  Writing attestation to chainId 2366...</div>
          <div className="text-slate-500">│  kite tx: 0x9f3e1...a4b2</div>
          <div className="text-slate-500">│  verify: https://kitescan.ai/tx/0x9f3e1...a4b2</div>
          <div className="text-emerald-400">└ <span className="text-emerald-400">attested</span></div>

          <div className="h-2" />
          <div className="text-slate-500">{'═'.repeat(60)}</div>
          <div className="text-emerald-400">✓ Cycle #47 COMPLETE <span className="text-slate-600">(4.2s) — next in 60s</span></div>
        </div>
      </motion.div>
    </section>
  )
}
