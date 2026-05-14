import { motion } from 'motion/react'
import { Github, ExternalLink } from 'lucide-react'

export default function Footer () {
  return (
    <footer className="max-w-[1200px] mx-auto px-6 md:px-12 mt-32 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="terminal"
      >
        <div className="terminal-header">
          <div className="terminal-dot bg-[#ff5f57]" />
          <div className="terminal-dot bg-[#febc2e]" />
          <div className="terminal-dot bg-[#28c840]" />
          <span className="ml-3 text-[11px] text-slate-500 font-mono">ready</span>
        </div>
        <div className="p-10 md:p-14 text-center">
          <div className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-[#152540] border border-white/[0.08]">
            <img src="/logo.png" alt="Kard" className="w-7 h-7 object-contain" />
          </div>
          <h3 className="mt-6 text-[28px] md:text-[32px] font-bold text-white">
            Start running Kard
          </h3>
          <p className="mt-3 text-slate-400 text-[15px] max-w-md mx-auto">
            Self-hosted. Open source. Your keys, your models, your rules.
            Every action verifiable on Kite AI.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#/docs"
              className="px-6 py-3 rounded-full bg-white text-[#0a1628] text-[13px] font-semibold hover:bg-slate-100 transition-colors"
            >
              Get started
            </a>
            <a
              href="https://github.com/Teckdegen/Kardsagentic"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#152540] border border-white/[0.08] text-[13px] font-medium text-slate-300 hover:border-white/[0.15] hover:text-white transition-all"
            >
              <Github size={14} />
              Source
            </a>
            <a
              href="https://docs.gokite.ai"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#152540] border border-white/[0.08] text-[13px] font-medium text-slate-300 hover:border-white/[0.15] hover:text-white transition-all"
            >
              <ExternalLink size={14} />
              Kite AI
            </a>
          </div>
        </div>
      </motion.div>

      {/* Bottom bar */}
      <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-slate-600">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-4 h-4 object-contain opacity-40" />
          <span>Kard — Agentic trading, settled on Kite AI</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Apache-2.0</span>
          <a href="https://github.com/Teckdegen/Kardsagentic" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">GitHub</a>
          <a href="https://docs.gokite.ai" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">Kite AI</a>
        </div>
      </div>
    </footer>
  )
}
