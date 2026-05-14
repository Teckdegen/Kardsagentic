export default function Footer () {
  return (
    <footer className="max-w-[1200px] mx-auto px-6 pt-32 pb-8">
      {/* Quote */}
      <div className="py-16 border-b border-[#1a1a1a]">
        <p className="text-[22px] md:text-[28px] font-serif italic text-[#52525b] leading-relaxed max-w-[550px]">
          "We bring autonomous execution to the protocols you already use. No new chains, no trusted parties, no compromises."
        </p>
      </div>

      {/* Copyright */}
      <div className="pt-6 text-[11px] uppercase tracking-[0.1em] text-[#3f3f46]">
        © 2026 KARD. ALL RIGHTS RESERVED
      </div>
    </footer>
  )
}
