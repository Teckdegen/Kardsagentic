export default function Footer () {
  return (
    <footer className="max-w-[1200px] mx-auto px-6 pt-32 pb-12">
      {/* CTA */}
      <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-12 md:p-16 text-center">
        <h3 className="text-[24px] md:text-[32px] font-bold text-white">
          Build Faster. Trade Smarter.
        </h3>
        <p className="mt-3 text-[15px] text-[#71717a]">
          Try the Kard CLI today.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="#/docs"
            className="px-6 py-3 rounded-lg bg-[#2563eb] text-white text-[14px] font-semibold hover:bg-[#1d4ed8] transition-colors"
          >
            Get started ↗
          </a>
        </div>
      </div>

      {/* Bottom */}
      <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-[#52525b]">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-4 h-4 object-contain opacity-40" />
          Kard — Agentic trading, settled on Kite AI
        </div>
        <div className="flex items-center gap-6">
          <span>Apache-2.0</span>
          <a href="https://github.com/Teckdegen/Kardsagentic" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          <a href="https://docs.gokite.ai" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Kite AI</a>
        </div>
      </div>
    </footer>
  )
}
