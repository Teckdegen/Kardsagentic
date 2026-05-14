import { motion } from 'motion/react'

const STRATEGIES = [
  { name: 'CONSERVATIVE', risk: 'Low', apy: '~3%', color: 'text-emerald-400 bg-emerald-500/10' },
  { name: 'KITE_YIELD', risk: 'Low', apy: '~7%', color: 'text-emerald-400 bg-emerald-500/10' },
  { name: 'USDT_YIELD', risk: 'Med', apy: '~8%', color: 'text-blue-400 bg-blue-500/10' },
  { name: 'BALANCED', risk: 'Med', apy: '~6%', color: 'text-blue-400 bg-blue-500/10' },
  { name: 'DELTA_NEUTRAL', risk: 'Med', apy: '~12%', color: 'text-blue-400 bg-blue-500/10' },
  { name: 'LP_FARMER', risk: 'Med', apy: '~15%', color: 'text-amber-400 bg-amber-500/10' },
  { name: 'FULL_STACK', risk: 'Med', apy: '~18%', color: 'text-amber-400 bg-amber-500/10' },
  { name: 'PERPS_TRADER', risk: 'High', apy: '~20%', color: 'text-red-400 bg-red-500/10' },
]

export default function Strategies () {
  return (
    <section className="max-w-[1200px] mx-auto mt-32 px-5 md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mx-auto mb-12"
      >
        <h2 className="text-[40px] md:text-[56px] font-extrabold tracking-[-0.03em] leading-[1.0] text-white">
          Strategies
        </h2>
        <p className="mt-5 text-[16px] leading-relaxed text-slate-400">
          8 built-in. Or set a goal and let the AI figure it out.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6 }}
        className="terminal max-w-[700px] mx-auto"
      >
        <div className="terminal-header">
          <div className="terminal-dot bg-[#ff5f57]" />
          <div className="terminal-dot bg-[#febc2e]" />
          <div className="terminal-dot bg-[#28c840]" />
          <span className="ml-4 text-[11px] text-slate-500 font-mono">kard strategy list</span>
        </div>
        <div className="terminal-body text-left">
          <div className="space-y-1">
            {STRATEGIES.map((s) => (
              <div key={s.name} className="flex items-center gap-3 py-1.5">
                <span className="text-emerald-400 font-mono text-[13px] font-medium w-[130px] shrink-0">{s.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${s.color} shrink-0`}>{s.risk}</span>
                <span className="text-cyan-300 font-mono text-[13px] font-medium w-[45px] shrink-0">{s.apy}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.04]">
            <div className="text-slate-500 text-[12px]">$ <span className="text-slate-300">kard run --strategy KITE_YIELD --interval 60s</span></div>
            <div className="text-slate-500 text-[12px]">$ <span className="text-slate-300">kard goal "maximize yield, no perps"</span></div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
