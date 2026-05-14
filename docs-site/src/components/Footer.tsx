export default function Footer () {
  return (
    <footer className="max-w-[1200px] mx-auto px-6 pt-32 pb-8">
      {/* CTA */}
      <div className="text-center py-16 border-b border-[#1a1a1a]">
        <h3 className="text-[24px] md:text-[32px] font-bold italic text-white">
          Build Faster. Trade Smarter.
        </h3>
        <p className="mt-3 text-[14px] text-[#52525b]">
          Try the Kard CLI today.
        </p>
        <div className="mt-8">
          <a
            href="#/docs"
            className="inline-flex px-6 py-3 rounded-lg bg-white text-black text-[14px] font-semibold hover:bg-[#e4e4e7] transition-colors"
          >
            Get started ↗
          </a>
        </div>
      </div>

      {/* Quote + Links */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-12 py-16 border-b border-[#1a1a1a]">
        <p className="text-[22px] md:text-[28px] font-serif italic text-[#52525b] leading-relaxed max-w-[550px]">
          "We bring autonomous execution to the protocols you already use. No new chains, no trusted parties, no compromises."
        </p>
        <div className="border-l border-[#1a1a1a] pl-8">
          <div className="text-[11px] uppercase tracking-[0.15em] text-[#52525b] font-medium mb-4">Links</div>
          <div className="space-y-3">
            <a href="https://x.com" target="_blank" rel="noreferrer" className="block text-[15px] text-[#a1a1aa] hover:text-white transition-colors">Twitter</a>
            <a href="https://github.com/Teckdegen/Kardsagentic" target="_blank" rel="noreferrer" className="block text-[15px] text-[#a1a1aa] hover:text-white transition-colors">GitHub</a>
            <a href="https://docs.gokite.ai" target="_blank" rel="noreferrer" className="block text-[15px] text-[#a1a1aa] hover:text-white transition-colors">Kite AI</a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="pt-6 text-[11px] uppercase tracking-[0.1em] text-[#3f3f46]">
        © 2026 KARD. ALL RIGHTS RESERVED
      </div>
    </footer>
  )
}
