import { motion } from 'motion/react'

export default function WhatIsKard () {
  return (
    <section className="max-w-[1200px] mx-auto px-6 pt-20">
      {/* Big statement */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center mb-24"
      >
        <h2 className="text-[40px] md:text-[60px] lg:text-[72px] font-black tracking-[-0.04em] leading-[0.95]">
          <span className="text-white">You describe.</span><br />
          <span className="text-[#2563eb]">We execute.</span>
        </h2>
        <p className="mt-6 text-[16px] md:text-[18px] text-[#71717a] max-w-[500px] mx-auto leading-relaxed">
          Kard is an autonomous AI trading agent <span className="text-white font-medium">that actually works</span>.
          <br /><br />
          Purpose-built for DeFi, Kard translates your ideas into executable strategies
          that perform trades on your behalf <span className="text-white font-medium">24/7</span>.
        </p>
      </motion.div>

      {/* How it works — 3 steps like Dawn */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="text-center mb-20"
      >
        <h3 className="text-[36px] md:text-[52px] font-black tracking-[-0.03em] leading-[1.0]">
          <span className="text-white">The </span>
          <span className="text-[#2563eb] italic">smart</span>
          <span className="text-white"><br />way to trade.</span>
        </h3>
      </motion.div>

      {/* Steps */}
      <div className="space-y-4 max-w-[900px] mx-auto">
        <Step
          num="01"
          title="Describe Your Strategy"
          desc="Tell Kard what you want in plain English. No coding required — just describe your trading idea."
          terminal={`$ kard claude "long ETH if RSI drops below 30, risk 2%, take profit 8%"\n\n⟡ Compiling strategy...\n✓ Conditions: RSI < 30 on ETH/USD 1h\n✓ Entry: market buy ETH\n✓ Size: 2% of equity at risk\n✓ Take profit: +8%\n✓ Stop loss: -2%\n\nReady to deploy. Run with --execute to go live.`}
        />
        <Step
          num="02"
          title="Agent Validates & Executes"
          desc="Kard converts your strategy into production-ready execution. Risk engine validates. Simulator pre-flights. Then it goes on-chain."
          terminal={`$ kard run --strategy KITE_YIELD --interval 60s\n\n[cycle #12] Observing 5 chains...\n[cycle #12] Lucid 7.2% > Aave 5.8% — moving $400\n[cycle #12] Risk: 10/10 ✓\n[cycle #12] Executing: USDC → Lucid (Arbitrum → Kite AI)\n[cycle #12] tx: 0x4a7f...c8d1 confirmed\n[cycle #12] Attested on Kite: 0x9f3e...a4b2\n[cycle #12] Done (4.2s) — next in 60s`}
        />
        <Step
          num="03"
          title="Runs 24/7, Learns, Adapts"
          desc="Your agent trades automatically while you sleep. Every 20 cycles it reviews what worked. Every action is verifiable on Kite AI."
          terminal={`$ kard goal "grow my portfolio 5% this month"\n\n🎯 Goal set: +5% in 30 days\n📊 Current: $4,200 → Target: $4,410\n\n[day 3]  +1.2% — Lucid yield + Aave rebalance\n[day 7]  +2.8% — caught Morpho rate spike\n[day 14] +4.1% — on track\n[day 21] +5.3% — goal achieved ✓\n\nAgent continues optimizing...`}
        />
      </div>
    </section>
  )
}

function Step ({ num, title, desc, terminal }: { num: string; title: string; desc: string; terminal: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6 p-6 md:p-8 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a]"
    >
      <div className="flex flex-col justify-center">
        <span className="text-[12px] font-mono font-bold text-[#2563eb] mb-2">Step {num}</span>
        <h4 className="text-[20px] md:text-[24px] font-bold text-white">{title}</h4>
        <p className="mt-3 text-[14px] leading-relaxed text-[#71717a]">{desc}</p>
      </div>
      <div className="terminal">
        <div className="terminal-header">
          <div className="terminal-dot bg-[#ff5f57]" />
          <div className="terminal-dot bg-[#febc2e]" />
          <div className="terminal-dot bg-[#28c840]" />
        </div>
        <div className="terminal-body text-[12px] text-[#a1a1aa] whitespace-pre-wrap">{terminal}</div>
      </div>
    </motion.div>
  )
}
