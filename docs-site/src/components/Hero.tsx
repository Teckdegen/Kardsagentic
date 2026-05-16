import { useState, useRef } from 'react'
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
            <span className="text-white">The trading runtime for AI agents.</span>
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

          {/* Right — interactive floating dots and protocol pills */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative h-[400px] hidden lg:block"
          >
            <InteractiveField />
          </motion.div>
        </div>
      </section>
    </>
  )
}

function InteractiveField () {
  const [items, setItems] = useState([
    { id: 'aave', x: 30, y: 18, label: 'Aave', variant: 'white' as const, profit: '+$58', detail: '5.8% APY on USDC · Arbitrum' },
    { id: 'uniswap', x: 58, y: 28, label: 'Uniswap', variant: 'white' as const, profit: '+$33', detail: '12.3% fees · USDC/USDT pool' },
    { id: 'lucid', x: 38, y: 48, label: 'Lucid', variant: 'blue' as const, detail: '7.2% APY · L-USDC on Kite AI' },
    { id: 'morpho', x: 68, y: 58, label: 'Morpho', variant: 'small' as const, detail: '8.4% APY · Base · peer-to-peer' },
    { id: 'hyperliquid', x: 25, y: 68, label: 'Hyperliquid', variant: 'blue' as const, detail: 'Perps · BTC/ETH/SOL · testnet' },
    { id: 'pendle', x: 58, y: 78, label: 'Pendle', variant: 'small' as const, detail: '9.1% fixed yield · PT-USDC' },
  ])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const dots = [
    { x: 10, y: 8, color: 'white' as const }, { x: 85, y: 5, color: 'white' as const },
    { x: 45, y: 10, color: 'blue' as const }, { x: 75, y: 15, color: 'blue' as const },
    { x: 18, y: 30, color: 'blue' as const }, { x: 92, y: 32, color: 'white' as const },
    { x: 5, y: 45, color: 'white' as const }, { x: 82, y: 42, color: 'blue' as const },
    { x: 12, y: 55, color: 'white' as const }, { x: 90, y: 55, color: 'blue' as const },
    { x: 48, y: 90, color: 'blue' as const }, { x: 75, y: 88, color: 'white' as const },
    { x: 30, y: 92, color: 'blue' as const }, { x: 8, y: 80, color: 'white' as const },
  ]

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setItems(prev => prev.map(item =>
      item.id === dragging ? { ...item, x: Math.max(5, Math.min(85, x)), y: Math.max(5, Math.min(90, y)) } : item
    ))
  }

  const handleMouseUp = () => setDragging(null)

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-default select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Static dots */}
      {dots.map((d, i) => (
        <div
          key={i}
          className={`absolute w-3 h-2 rounded-full ${d.color === 'blue' ? 'bg-blue-500' : 'bg-white'} opacity-50`}
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
        />
      ))}

      {/* Interactive pills */}
      {items.map(item => (
        <div
          key={item.id}
          className={`absolute transition-all duration-150 ${dragging === item.id ? 'scale-110 z-50' : 'z-10'} cursor-grab active:cursor-grabbing`}
          style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
          onMouseDown={(e) => { e.preventDefault(); setDragging(item.id) }}
          onClick={() => setExpanded(expanded === item.id ? null : item.id)}
        >
          {/* Pill */}
          <div className={`rounded-full px-4 py-2 font-medium text-[13px] shadow-lg whitespace-nowrap transition-all ${
            item.variant === 'blue' ? 'bg-blue-600 text-white hover:bg-blue-500' :
            item.variant === 'small' ? 'bg-[#1a1a1a] border border-[#333] text-[#a1a1aa] hover:border-[#555]' :
            'bg-[#f0ede8] text-[#1a1a1a] hover:bg-white'
          }`}>
            {item.profit && <span className="text-emerald-600 text-[11px] font-bold block -mb-0.5">{item.profit}</span>}
            {item.label}
          </div>

          {/* Expanded detail */}
          {expanded === item.id && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg bg-[#111] border border-[#333] text-[11px] text-[#a1a1aa] whitespace-nowrap shadow-xl z-50">
              {item.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

