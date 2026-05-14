import { motion } from 'motion/react'

export default function Hero () {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Blue glow */}
      <div className="hero-glow" />

      {/* Nav */}
      <nav className="relative z-10 max-w-[1200px] mx-auto px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Kard" className="w-6 h-6 object-contain" />
          <span className="text-[15px] font-bold text-white">Kard</span>
        </div>
        <a
          href="#/docs"
          className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-[12px] font-semibold hover:bg-[#1d4ed8] transition-colors"
        >
          Docs ↗
        </a>
      </nav>

      {/* Hero text */}
      <div className="relative z-10 max-w-[1000px] mx-auto text-center pt-28 md:pt-40 pb-20 px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-[48px] md:text-[72px] lg:text-[84px] font-black tracking-[-0.04em] leading-[0.95]"
        >
          <span className="text-white">The most </span>
          <span className="text-[#2563eb]">powerful</span>
          <span className="text-white"> way<br />to run </span>
          <span className="text-[#2563eb]">AI agents</span>
          <span className="text-white">.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8 text-[16px] md:text-[18px] leading-relaxed text-[#71717a] max-w-[600px] mx-auto"
        >
          <span className="text-white font-medium">Kard</span> translates your ideas into on-chain execution,
          performing <span className="text-[#2563eb]">how</span> you want, <span className="text-[#2563eb]">when</span> you want, on <span className="text-white font-medium">any DeFi protocol</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex items-center justify-center gap-4"
        >
          <a
            href="#/docs"
            className="px-6 py-3 rounded-lg bg-[#2563eb] text-white text-[14px] font-semibold hover:bg-[#1d4ed8] transition-colors"
          >
            Get started
          </a>
          <a
            href="https://github.com/Teckdegen/Kardsagentic"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-lg border border-[#27272a] text-[#a1a1aa] text-[14px] font-medium hover:border-[#3f3f46] hover:text-white transition-all"
          >
            GitHub
          </a>
        </motion.div>
      </div>
    </section>
  )
}
