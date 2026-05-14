import { motion } from 'motion/react'
import HlsVideo from './HlsVideo'

const HERO_VIDEO = 'https://stream.mux.com/jPyJ2YM6Nlly7U6EyfxM01tz4D4uPE3gyJ4PYuvY62Wg.m3u8'

export default function Hero () {
  return (
    <section className="relative w-full overflow-hidden">
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

      {/* Hero — split layout like Dawn */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 pt-20 md:pt-28 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-[44px] md:text-[56px] lg:text-[64px] font-light tracking-[-0.03em] leading-[1.05]">
              <span className="text-white">You describe.</span><br />
              <span className="text-white font-normal">We execute.</span>
            </h1>
            <p className="mt-8 text-[15px] md:text-[16px] leading-relaxed text-[#71717a] max-w-[420px]">
              Kard is an autonomous AI trading agent <span className="text-white font-medium italic">that actually works</span>.
            </p>
            <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-[#71717a] max-w-[420px]">
              Purpose-built for DeFi, Kard translates your ideas into executable strategies
              that perform trades on your behalf <span className="text-white font-bold italic">24/7</span>.
            </p>
            <div className="mt-10 flex items-center gap-4">
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

          {/* Right — HLS video (black & white) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-black"
          >
            <HlsVideo
              src={HERO_VIDEO}
              className="w-full h-full object-cover grayscale brightness-75"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
