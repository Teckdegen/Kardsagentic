import { motion } from 'motion/react'
import { ArrowRight, Github, BookOpen } from 'lucide-react'

export default function Hero () {
  return (
    <section className="relative w-full max-w-[1200px] mx-auto pt-8 px-6 md:px-12">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between mb-20"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0f1d32] border border-white/[0.08] flex items-center justify-center">
            <img src="/logo.png" alt="Kard" className="w-5 h-5 object-contain" />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">Kard</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#what-is-kard" className="text-[13px] text-slate-400 hover:text-white transition-colors">What is Kard</a>
          <a href="#how-it-works" className="text-[13px] text-slate-400 hover:text-white transition-colors">How it works</a>
          <a href="#kite" className="text-[13px] text-slate-400 hover:text-white transition-colors">Kite AI</a>
          <a href="#/docs" className="text-[13px] text-slate-400 hover:text-white transition-colors">Docs</a>
        </div>
        <a
          href="https://github.com/Teckdegen/Kardsagentic"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0f1d32] border border-white/[0.08] text-[12px] font-medium text-slate-300 hover:border-white/[0.15] hover:text-white transition-all"
        >
          <Github size={14} />
          GitHub
        </a>
      </motion.nav>

      {/* Hero content */}
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/[0.08] border border-emerald-500/[0.2] text-[12px] font-semibold text-emerald-400 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-soft" />
            Live on Kite AI — Testnet &amp; Mainnet
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-[48px] md:text-[72px] font-bold tracking-tight leading-[1.0] text-white"
        >
          Your AI trades.<br />
          <span className="gradient-text-accent">Kite verifies.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-6 text-[16px] md:text-[18px] leading-relaxed text-slate-400 max-w-2xl mx-auto"
        >
          Kard is a self-hosted agent runtime that turns plain-English strategies
          into real on-chain execution — lending, trading, bridging — with every
          action cryptographically attested on Kite AI.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#/docs"
            className="group flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0a1628] text-[14px] font-semibold hover:bg-slate-100 transition-colors"
          >
            <BookOpen size={16} />
            Get started
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </a>
          <a
            href="#what-is-kard"
            className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#0f1d32] border border-white/[0.08] text-[14px] font-medium text-slate-300 hover:border-white/[0.15] hover:text-white transition-all"
          >
            Learn more
          </a>
        </motion.div>

        {/* Terminal preview — the main visual */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="terminal shadow-2xl shadow-blue-500/[0.03]">
            <div className="terminal-header">
              <div className="terminal-dot bg-[#ff5f57]" />
              <div className="terminal-dot bg-[#febc2e]" />
              <div className="terminal-dot bg-[#28c840]" />
              <span className="ml-3 text-[11px] text-slate-500 font-mono">kard — autonomous agent</span>
            </div>
            <div className="terminal-body text-left">
              <Line prompt>kard claude "park my USDC at the highest yield"</Line>
              <Line />
              <Line color="blue">⟡ Compiling strategy with Claude Haiku...</Line>
              <Line color="dim">  Scanning 8 protocols across 5 chains...</Line>
              <Line />
              <Line color="green">✓ Best opportunity: Lucid L-USDC on Kite AI — 7.2% APY</Line>
              <Line color="green">✓ Risk engine: 10/10 checks passed</Line>
              <Line color="green">✓ Simulator: eth_call pre-flight OK</Line>
              <Line />
              <Line color="cyan">→ Executing: supply 300 USDC → Lucid (Arbitrum → Kite AI)</Line>
              <Line color="dim">  tx: 0x4a7f2e...c8d1 confirmed (block 182,441,203)</Line>
              <Line />
              <Line color="purple">⛓ Attestation written to Kite AI</Line>
              <Line color="dim">  https://kitescan.ai/tx/0x9f3e1...a4b2</Line>
              <Line />
              <Line color="green">✓ Cycle complete — next check in 60s</Line>
              <Line prompt />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Line ({ children, prompt, color }: { children?: React.ReactNode; prompt?: boolean; color?: string }) {
  const colorClass = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    dim: 'text-slate-500',
    red: 'text-red-400'
  }[color || ''] || 'text-slate-300'

  if (prompt) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-emerald-400">$</span>
        <span className="text-slate-200">{children}</span>
        {!children && <span className="w-2 h-4 bg-slate-400 animate-pulse" />}
      </div>
    )
  }
  if (!children) return <div className="h-3" />
  return <div className={colorClass}>{children}</div>
}
