import { motion } from 'motion/react'

export default function HowItWorks () {
  return (
    <section id="how-it-works" className="max-w-[1200px] mx-auto px-6 pt-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <h2 className="text-[40px] md:text-[60px] font-black tracking-[-0.04em] leading-[0.95]">
          <span className="text-white">The </span>
          <span className="text-[#2563eb] italic">all-in-one</span>
          <span className="text-white"> terminal<br />at your fingertips.</span>
        </h2>
      </motion.div>

      {/* Feature rows — alternating layout like Dawn */}
      <div className="space-y-6 max-w-[900px] mx-auto">
        <FeatureRow
          title="Research"
          points={['Real-time yield scanning across 8 protocols', 'Live funding rates and APY comparison', 'Risk-free backtesting on historical data']}
          terminal={`$ kard opportunities\n\n 1. Morpho USDC (Base)     8.4% APY  low risk\n 2. Lucid L-USDC (Kite)    7.2% APY  low risk\n 3. Aave USDC (Arbitrum)   5.8% APY  low risk\n 4. Compound (Arbitrum)    5.4% APY  low risk\n 5. Pendle PT-USDC (Base)  9.1% APY  fixed`}
          reverse={false}
        />
        <FeatureRow
          title="Execution"
          points={['On-chain trades across 5 chains', 'No platform fees — keep 100% of profits', 'Custom strategies and risk limits']}
          terminal={`$ kard claude "park USDC at highest yield" --execute\n\n✓ Scanning protocols...\n✓ Best: Lucid L-USDC 7.2% (Kite AI)\n✓ Risk engine: passed\n→ Supplying 500 USDC to Lucid\n✓ tx: 0x4a7f...c8d1 confirmed\n✓ Attested on Kite AI`}
          reverse={true}
        />
        <FeatureRow
          title="Infrastructure"
          points={['Self-hosted — your keys, your machine', 'Auto gas bridging across L2s', '24/7 autonomous operation with kill switch']}
          terminal={`$ kard gas\n\n Arbitrum    ETH  0.045  ✓ OK\n Base        ETH  0.032  ✓ OK\n Optimism    ETH  0.028  ✓ OK\n Kite AI     KITE 2.500  ✓ OK\n\n✓ Gas healthy on all chains.\n  Auto-bridge: Arbitrum → Base/Optimism when low.`}
          reverse={false}
        />
      </div>
    </section>
  )
}

function FeatureRow ({ title, points, terminal, reverse }: { title: string; points: string[]; terminal: string; reverse: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-6 items-center ${reverse ? 'lg:direction-rtl' : ''}`}
      style={reverse ? { direction: 'rtl' } : {}}
    >
      <div style={{ direction: 'ltr' }}>
        <h3 className="text-[22px] font-bold text-white mb-4">{title}</h3>
        <ul className="space-y-2.5">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#71717a]">
              <span className="text-[#2563eb] mt-0.5">•</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="terminal" style={{ direction: 'ltr' }}>
        <div className="terminal-header">
          <div className="terminal-dot bg-[#ff5f57]" />
          <div className="terminal-dot bg-[#febc2e]" />
          <div className="terminal-dot bg-[#28c840]" />
        </div>
        <div className="terminal-body text-[11.5px] text-[#a1a1aa] whitespace-pre-wrap">{terminal}</div>
      </div>
    </motion.div>
  )
}
