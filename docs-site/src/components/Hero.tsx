import { motion } from 'motion/react'
import HlsVideo from './HlsVideo'

const HERO_VIDEO = 'https://stream.mux.com/jPyJ2YM6Nlly7U6EyfxM01tz4D4uPE3gyJ4PYuvY62Wg.m3u8'
const HERO_MP4 = 'https://stream.mux.com/jPyJ2YM6Nlly7U6EyfxM01tz4D4uPE3gyJ4PYuvY62Wg/high.mp4'

export default function Hero () {
  return (
    <>
      {/* ═══ HEADER — video background with big centered text (like Dawn) ═══ */}
      <section className="relative w-full overflow-hidden">
        {/* Video behind text */}
        <div className="absolute inset-0 z-0">
          <HlsVideo
            src={HERO_VIDEO}
            fallbackMp4={HERO_MP4}
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black" />
        </div>

        {/* Nav */}
        <nav className="relative z-20 max-w-[1200px] mx-auto px-6 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Kard" className="w-6 h-6 object-contain" />
            <span className="text-[15px] font-bold text-white">Kard</span>
          </div>
          <a
            href="#/docs"
            className="px-4 py-2 rounded-lg bg-white text-black text-[12px] font-semibold hover:bg-[#e4e4e7] transition-colors"
          >
            Docs ↗
          </a>
        </nav>

        {/* Big centered headline over video */}
        <div className="relative z-10 max-w-[900px] mx-auto text-center px-6 pt-32 md:pt-44 pb-36 md:pb-48">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[48px] md:text-[72px] lg:text-[88px] font-black tracking-[-0.04em] leading-[0.9] italic"
          >
            <span className="text-white">The most </span>
            <span className="text-[#2563eb]">powerful</span>
            <span className="text-white"> way to run AI agents.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 text-[15px] md:text-[17px] text-[#a1a1aa] max-w-[550px] mx-auto leading-relaxed"
          >
            <span className="text-white font-medium">Kard</span> translates your ideas into on-chain execution,
            performing <span className="text-[#2563eb]">how</span> you want, <span className="text-[#2563eb]">when</span> you want, on <span className="text-white font-medium">any DeFi protocol</span>.
          </motion.p>
        </div>
      </section>

      {/* ═══ SECOND SECTION — "You describe. We execute." ═══ */}
      <section className="max-w-[1200px] mx-auto px-6 py-28 md:py-36 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-[48px] md:text-[72px] lg:text-[84px] font-black tracking-[-0.04em] leading-[0.95]">
            <span className="text-white">You describe.</span><br />
            <span className="text-white">We execute.</span>
          </h2>
          <p className="mt-8 text-[16px] md:text-[18px] text-[#71717a] max-w-[500px] mx-auto leading-relaxed">
            Kard is an autonomous AI trading agent <span className="text-white font-bold">that actually works</span>.
          </p>
          <p className="mt-4 text-[16px] md:text-[18px] text-[#71717a] max-w-[500px] mx-auto leading-relaxed">
            Purpose-built for DeFi, Kard translates your ideas into executable strategies
            that perform trades on your behalf <span className="text-white font-bold italic">24/7</span>.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              href="#/docs"
              className="px-6 py-3 rounded-lg bg-white text-black text-[14px] font-semibold hover:bg-[#e4e4e7] transition-colors"
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
          </div>
        </motion.div>
      </section>
    </>
  )
}
