import { motion } from 'motion/react'

export default function HowItWorks () {
  return (
    <section id="how-it-works" className="max-w-[1200px] mx-auto mt-32 px-5 md:px-10 scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mx-auto mb-12"
      >
        <h2 className="text-[40px] md:text-[56px] font-extrabold tracking-[-0.03em] leading-[1.0] text-white">
          Every cycle
        </h2>
        <p className="mt-5 text-[16px] leading-relaxed text-slate-400">
          Intelligence proposes. Infrastructure executes. Kite verifies.
        </p>
      </motion.div>

      {/* Big terminal showing a full cycle */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="terminal glow-blue max-w-[860px] mx-auto"
      >
        <div className="terminal-header">
          <div className="terminal-dot bg-[#ff5f57]" />
          <div className="terminal-dot bg-[#febc2e]" />
          <div className="terminal-dot bg-[#28c840]" />
          <span className="ml-4 text-[11px] text-slate-500 font-mono">kard run --strategy KITE_YIELD</span>
        </div>
        <div className="terminal-body text-left leading-[2]">
          <div className="text-slate-600">{'━'.repeat(50)}</div>
          <div className="text-white font-bold">CYCLE #47</div>
          <div className="text-slate-600">{'━'.repeat(50)}</div>
          <div className="h-1" />

          <div><span className="text-blue-400 font-bold">01</span> <span className="text-slate-500">│</span> <span className="text-slate-300">Observe</span> <span className="text-slate-600">— reading 5 chains</span></div>
          <div className="text-slate-500 pl-6">USDC: 1,200 | ETH: 0.045 | Aave supplied: $800</div>
          <div className="h-1" />

          <div><span className="text-purple-400 font-bold">02</span> <span className="text-slate-500">│</span> <span className="text-slate-300">Reason</span> <span className="text-slate-600">— Claude Haiku (1.3s)</span></div>
          <div className="text-slate-500 pl-6">"Lucid 7.2% &gt; Aave 5.8%. Move $400 idle USDC."</div>
          <div className="h-1" />

          <div><span className="text-amber-400 font-bold">03</span> <span className="text-slate-500">│</span> <span className="text-slate-300">Validate</span> <span className="text-emerald-400">— 10/10 passed</span></div>
          <div className="text-slate-500 pl-6">gas ✓ balance ✓ confidence ✓ leverage ✓ simulator ✓</div>
          <div className="h-1" />

          <div><span className="text-cyan-400 font-bold">04</span> <span className="text-slate-500">│</span> <span className="text-slate-300">Execute</span> <span className="text-slate-600">— Lucid mint</span></div>
          <div className="text-slate-500 pl-6">tx: <span className="text-blue-400">0x4a7f2e...c8d1</span> confirmed (2.1s)</div>
          <div className="h-1" />

          <div><span className="text-emerald-400 font-bold">05</span> <span className="text-slate-500">│</span> <span className="text-slate-300">Attest</span> <span className="text-slate-600">— Kite AI (chainId 2366)</span></div>
          <div className="text-slate-500 pl-6">kite: <span className="text-purple-400">0x9f3e1...a4b2</span></div>
          <div className="h-1" />

          <div className="text-slate-600">{'━'.repeat(50)}</div>
          <div className="text-emerald-400 font-bold">✓ DONE <span className="text-slate-500 font-normal">4.2s — next cycle in 60s</span></div>
        </div>
      </motion.div>
    </section>
  )
}
