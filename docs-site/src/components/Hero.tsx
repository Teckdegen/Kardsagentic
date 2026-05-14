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
            <span className="text-white">The most powerful way to run AI agents.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 text-[15px] md:text-[17px] text-[#a1a1aa] max-w-[550px] mx-auto leading-relaxed"
          >
            <span className="text-white font-medium">Kard</span> translates your ideas into on-chain execution,
            performing how you want, when you want, on <span className="text-white font-medium">any DeFi protocol</span>.
          </motion.p>
        </div>
      </section>

      {/* ═══ SECOND SECTION — "You describe. We execute." ═══ */}
      <section className="max-w-[1200px] mx-auto px-6 py-28 md:py-36 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-[40px] md:text-[52px] font-light tracking-[-0.03em] leading-[1.1]">
              <span className="text-white">You describe.</span><br />
              <span className="text-white">We execute.</span>
            </h2>
            <p className="mt-8 text-[15px] text-[#71717a] leading-relaxed max-w-[420px]">
              Kard is an autonomous AI trading agent <span className="text-white font-bold">that actually works</span>.
            </p>
            <p className="mt-4 text-[15px] text-[#71717a] leading-relaxed max-w-[420px]">
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

          {/* Right — floating dots and protocol pills */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative h-[400px] hidden lg:block"
          >
            {/* Scattered dots */}
            <Dot x={10} y={8} color="white" />
            <Dot x={85} y={5} color="white" />
            <Dot x={45} y={12} color="blue" />
            <Dot x={72} y={18} color="blue" />
            <Dot x={20} y={25} color="blue" />
            <Dot x={90} y={30} color="white" />
            <Dot x={5} y={45} color="white" />
            <Dot x={60} y={42} color="blue" />
            <Dot x={35} y={55} color="white" />
            <Dot x={80} y={55} color="blue" />
            <Dot x={15} y={70} color="blue" />
            <Dot x={50} y={72} color="white" />
            <Dot x={92} y={68} color="blue" />
            <Dot x={25} y={85} color="white" />
            <Dot x={70} y={88} color="blue" />
            <Dot x={42} y={92} color="blue" />

            {/* Floating protocol pills */}
            <Pill x={30} y={20} label="Aave" variant="white" profit="+$58" />
            <Pill x={55} y={30} label="Uniswap" variant="white" profit="+$33" />
            <Pill x={40} y={50} label="Lucid" variant="blue" />
            <Pill x={65} y={60} label="Morpho" variant="small" />
            <Pill x={25} y={70} label="Hyperliquid" variant="blue" />
            <Pill x={55} y={78} label="Pendle" variant="small" />
          </motion.div>
        </div>
      </section>
    </>
  )
}

function Dot ({ x, y, color }: { x: number; y: number; color: 'white' | 'blue' }) {
  return (
    <div
      className={`absolute w-3 h-2 rounded-full ${color === 'blue' ? 'bg-blue-500' : 'bg-white'} opacity-60`}
      style={{ left: `${x}%`, top: `${y}%` }}
    />
  )
}

function Pill ({ x, y, label, variant, profit }: { x: number; y: number; label: string; variant: 'white' | 'blue' | 'small'; profit?: string }) {
  if (variant === 'small') {
    return (
      <div
        className="absolute px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#333] text-[11px] text-[#a1a1aa] font-medium"
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        {label}
      </div>
    )
  }
  return (
    <div
      className={`absolute rounded-full px-4 py-2 font-medium text-[13px] shadow-lg ${
        variant === 'blue'
          ? 'bg-blue-600 text-white'
          : 'bg-[#f0ede8] text-[#1a1a1a]'
      }`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {profit && <span className="text-emerald-600 text-[11px] font-bold block -mb-0.5">{profit}</span>}
      {label}
    </div>
  )
}
