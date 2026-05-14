import { motion } from 'motion/react'
import { ArrowRight, Github, Terminal } from 'lucide-react'

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
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <img src="/logo.png" alt="Kard" className="w-5 h-5 object-contain" />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">Kard</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#what-is-kard" className="text-[13px] text-slate-400 hover:text-white transition-colors">What is Kard</a>
          <a href="#how-it-works" className="text-[13px] text-slate-400 hover:text-white transition-colors">How it works</a>
          <a href="#kite" className="text-[13px] text-slate-400 hover:text-white transition-colors">Kite AI</a>
          <a href="#install" className="text-[13px] text-slate-400 hover:text-white transition-colors">Install</a>
        </div>
        <a
          href="https://github.com/Teckdegen/Kardsagentic"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[12px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400 mb-8">
            <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-ring" />
            Live on Kite AI — Testnet &amp; Mainnet
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-[48px] md:text-[72px] font-semibold tracking-tight leading-[1.0] text-white"
        >
          Your AI trades.<br />
          <span className="gradient-text-blue">Kite verifies.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-6 text-[16px] md:text-[18px] leading-relaxed text-slate-400 max-w-2xl mx-auto"
        >
          Kard is a self-hosted agent runtime that turns plain-English strategies
          into real on-chain execution — lending, trading, bridging — with every
          action cryptographically attested on Kite AI. You hold every key.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#install"
            className="group flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#050505] text-[14px] font-semibold hover:bg-slate-100 transition-colors"
          >
            <Terminal size={16} />
            Get started
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </a>
          <a
            href="#what-is-kard"
            className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-white/5 border border-white/10 text-[14px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            Learn more
          </a>
        </motion.div>

        {/* Terminal preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-16 max-w-2xl mx-auto"
        >
          <div className="rounded-2xl bg-[#0c0c0c] border border-white/[0.06] overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[11px] text-slate-500 font-mono">kard</span>
            </div>
            <div className="p-5 font-mono text-[12.5px] leading-relaxed text-left">
              <div className="text-slate-500">$ kard claude "park my USDC at the highest yield"</div>
              <div className="mt-3 text-slate-400">
                <span className="text-blue-400">⟡</span> Compiling strategy...
              </div>
              <div className="mt-1 text-slate-400">
                <span className="text-emerald-400">✓</span> Lucid L-USDC on Kite AI: <span className="text-emerald-400">7.2% APY</span> (vs Aave 5.8%)
              </div>
              <div className="mt-1 text-slate-400">
                <span className="text-emerald-400">✓</span> Risk engine: all 10 checks passed
              </div>
              <div className="mt-1 text-slate-400">
                <span className="text-emerald-400">✓</span> Executing: supply 300 USDC → Lucid (Arbitrum → Kite AI)
              </div>
              <div className="mt-1 text-slate-400">
                <span className="text-purple-400">⛓</span> Attested on Kite: <span className="text-blue-400 underline">0x9f3e1...a4b2</span>
              </div>
              <div className="mt-3 text-slate-500">$</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
