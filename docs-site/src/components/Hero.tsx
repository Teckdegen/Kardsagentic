import { motion } from 'motion/react'
import { ArrowRight, Github, BookOpen } from 'lucide-react'

export default function Hero () {
  return (
    <section className="relative w-full max-w-[1200px] mx-auto pt-6 px-5 md:px-10">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between py-4"
      >
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Kard" className="w-7 h-7 object-contain" />
          <span className="text-[16px] font-bold text-white">Kard</span>
        </div>
        <div className="hidden md:flex items-center gap-7">
          <a href="#features" className="text-[13px] text-slate-400 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-[13px] text-slate-400 hover:text-white transition-colors">How it works</a>
          <a href="#kite" className="text-[13px] text-slate-400 hover:text-white transition-colors">Kite AI</a>
          <a href="#/docs" className="text-[13px] text-slate-400 hover:text-white transition-colors">Docs</a>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Teckdegen/Kardsagentic"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-white transition-colors"
          >
            <Github size={15} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="#/docs"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-[#030712] text-[12px] font-semibold hover:bg-slate-200 transition-colors"
          >
            Get started
          </a>
        </div>
      </motion.nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto text-center pt-20 md:pt-28 pb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass-strong text-[12px] font-medium text-emerald-400 mb-10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-glow" />
            Live on Kite AI — Testnet &amp; Mainnet
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-[52px] md:text-[80px] lg:text-[88px] font-extrabold tracking-[-0.03em] leading-[0.95]"
        >
          <span className="text-gradient-subtle">Your AI trades.</span>
          <br />
          <span className="text-gradient">Kite verifies.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-7 text-[17px] md:text-[19px] leading-relaxed text-slate-400 max-w-[620px] mx-auto"
        >
          Self-hosted AI agent that turns plain English into real DeFi execution.
          Lending, perps, bridging — every action attested on Kite AI. You hold every key.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#/docs"
            className="group flex items-center gap-2.5 px-8 py-4 rounded-xl bg-white text-[#030712] text-[14px] font-bold hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all"
          >
            <BookOpen size={16} />
            Get started
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="https://github.com/Teckdegen/Kardsagentic"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 px-8 py-4 rounded-xl glass-strong text-[14px] font-semibold text-slate-200 hover:bg-white/[0.06] transition-all"
          >
            <Github size={16} />
            View source
          </a>
        </motion.div>
      </div>

      {/* Terminal — the hero visual */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="mt-8 max-w-[800px] mx-auto"
      >
        <div className="terminal glow-sm">
          <div className="terminal-header">
            <div className="terminal-dot bg-[#ff5f57]" />
            <div className="terminal-dot bg-[#febc2e]" />
            <div className="terminal-dot bg-[#28c840]" />
            <span className="ml-4 text-[11px] text-slate-500 font-mono">kard — cycle #47</span>
          </div>
          <div className="terminal-body text-left">
            <div className="text-slate-500">$ kard run --strategy KITE_YIELD --interval 60s</div>
            <div className="h-3" />
            <div className="text-blue-400">⟡ <span className="text-slate-300">Scanning 8 protocols across 5 chains...</span></div>
            <div className="text-emerald-400">✓ <span className="text-slate-300">Lucid L-USDC on Kite AI: <span className="text-emerald-400 font-medium">7.2% APY</span></span></div>
            <div className="text-emerald-400">✓ <span className="text-slate-300">Risk engine: <span className="text-emerald-400">10/10</span> checks passed</span></div>
            <div className="text-emerald-400">✓ <span className="text-slate-300">Simulator pre-flight OK</span></div>
            <div className="h-2" />
            <div className="text-cyan-400">→ <span className="text-slate-300">Executing: supply 300 USDC → Lucid (Arbitrum → Kite AI)</span></div>
            <div className="text-slate-500">  tx: 0x4a7f2e...c8d1 confirmed</div>
            <div className="h-2" />
            <div className="text-purple-400">⛓ <span className="text-slate-300">Attested on Kite AI</span></div>
            <div className="text-blue-400 text-[12px]">  https://kitescan.ai/tx/0x9f3e1...a4b2</div>
            <div className="h-2" />
            <div className="text-emerald-400 font-medium">✓ Cycle complete — next in 60s</div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
