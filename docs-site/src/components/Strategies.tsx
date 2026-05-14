import { motion } from 'motion/react'

const STRATEGIES = [
  { name: 'CONSERVATIVE', risk: 'Low', apy: '~3%', desc: 'Aave lending only. Safe and slow.' },
  { name: 'KITE_YIELD', risk: 'Low', apy: '~7%', desc: 'Lucid L-USDC on Kite AI + Aave. Kite-native.' },
  { name: 'USDT_YIELD', risk: 'Low-Med', apy: '~8%', desc: 'Consolidate stables → USDT → Aave.' },
  { name: 'BALANCED', risk: 'Medium', apy: '~6%', desc: 'Aave + liquidity. Middle ground.' },
  { name: 'DELTA_NEUTRAL', risk: 'Low-Med', apy: '~12%', desc: 'Long spot + short perp. Market-neutral.' },
  { name: 'LP_FARMER', risk: 'Medium', apy: '~15%', desc: 'Uniswap V3 + Aerodrome + Beefy.' },
  { name: 'FULL_STACK', risk: 'Medium', apy: '~18%', desc: 'All protocols combined.' },
  { name: 'PERPS_TRADER', risk: 'High', apy: '~20%', desc: 'Hyperliquid + GMX perps.' },
]

export default function Strategies () {
  return (
    <section className="max-w-[1200px] mx-auto mt-32 px-6 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto mb-12"
      >
        <h2 className="text-[36px] md:text-[48px] font-bold tracking-tight leading-[1.05] text-white">
          Built-in strategies
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-slate-400">
          Pick one or let the AI figure it out with goal mode.
        </p>
      </motion.div>

      {/* Terminal-style strategy table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6 }}
        className="terminal max-w-3xl mx-auto"
      >
        <div className="terminal-header">
          <div className="terminal-dot bg-[#ff5f57]" />
          <div className="terminal-dot bg-[#febc2e]" />
          <div className="terminal-dot bg-[#28c840]" />
          <span className="ml-3 text-[11px] text-slate-500 font-mono">kard strategy list</span>
        </div>
        <div className="terminal-body text-left">
          <div className="text-slate-500 mb-3">Available strategies:</div>
          <div className="grid gap-2">
            {STRATEGIES.map((s) => (
              <div key={s.name} className="flex items-start gap-3 py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-emerald-400 font-mono text-[12px] w-[140px] shrink-0">{s.name}</span>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  s.risk === 'Low' ? 'bg-emerald-500/10 text-emerald-400' :
                  s.risk === 'Low-Med' ? 'bg-blue-500/10 text-blue-400' :
                  s.risk === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-red-500/10 text-red-400'
                }`}>{s.risk}</span>
                <span className="text-cyan-400 font-mono text-[12px] w-[50px] shrink-0">{s.apy}</span>
                <span className="text-slate-500 text-[12px]">{s.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-slate-500 text-[12px]">
            Run: <span className="text-slate-300">kard run --strategy KITE_YIELD --interval 60s</span>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
