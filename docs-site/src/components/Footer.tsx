import { Github, ExternalLink } from 'lucide-react'

export default function Footer () {
  return (
    <footer className="max-w-[1200px] mx-auto px-5 md:px-10 mt-32 pb-12">
      {/* CTA */}
      <div className="rounded-[28px] glass-strong p-12 md:p-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.03] pointer-events-none" />
        <div className="relative z-10">
          <img src="/logo.png" alt="Kard" className="w-12 h-12 mx-auto mb-6 object-contain" />
          <h3 className="text-[32px] md:text-[40px] font-extrabold text-white tracking-[-0.02em]">
            Start running Kard
          </h3>
          <p className="mt-4 text-slate-400 text-[16px] max-w-md mx-auto leading-relaxed">
            Self-hosted. Open source. Your keys, your models, your rules.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#/docs"
              className="px-7 py-3.5 rounded-xl bg-white text-[#030712] text-[14px] font-bold hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all"
            >
              Get started
            </a>
            <a
              href="https://github.com/Teckdegen/Kardsagentic"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl glass text-[14px] font-semibold text-slate-200 hover:bg-white/[0.06] transition-all"
            >
              <Github size={15} />
              Source
            </a>
            <a
              href="https://docs.gokite.ai"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl glass text-[14px] font-semibold text-slate-200 hover:bg-white/[0.06] transition-all"
            >
              <ExternalLink size={15} />
              Kite AI
            </a>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-slate-600">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-4 h-4 object-contain opacity-30" />
          Kard — Agentic trading, settled on Kite AI
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
