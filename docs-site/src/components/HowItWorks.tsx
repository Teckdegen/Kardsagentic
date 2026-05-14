import { motion } from 'motion/react'

const STAGES = [
  {
    num: '01',
    title: 'You describe what you want',
    desc: 'Write a strategy in plain English. "Long ETH if RSI drops below 30, risk 2%." or "Park my USDC at the highest yield."',
    color: 'text-blue-400'
  },
  {
    num: '02',
    title: 'AI compiles the plan',
    desc: 'Your chosen LLM (Claude, GPT, DeepSeek, or local Ollama) turns your words into a structured execution blueprint with conditions, actions, and risk limits.',
    color: 'text-purple-400'
  },
  {
    num: '03',
    title: 'Risk engine validates',
    desc: '10 hard safety checks run before anything touches the market. Not enough gas? Position too big? Confidence too low? Action is blocked — not warned, blocked.',
    color: 'text-amber-400'
  },
  {
    num: '04',
    title: 'Agent executes on-chain',
    desc: 'Approved actions go live: opening perp positions, supplying to Aave, swapping tokens, minting L-USDC on Kite via Lucid, bridging cross-chain.',
    color: 'text-emerald-400'
  },
  {
    num: '05',
    title: 'Kite AI records the proof',
    desc: 'Every action generates a cryptographically signed attestation on Kite AI — what happened, why, the confidence score, risk rating, and tx hash. Permanent. Verifiable.',
    color: 'text-cyan-400'
  },
  {
    num: '06',
    title: 'Agent learns and repeats',
    desc: 'Every 20 cycles, Kard reviews what worked and folds those lessons into its reasoning. Then it waits for the next cycle — 24/7, without you.',
    color: 'text-rose-400'
  }
]

export default function HowItWorks () {
  return (
    <section id="how-it-works" className="max-w-[1200px] mx-auto mt-32 px-6 md:px-12 scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto mb-16"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] font-semibold text-slate-400 mb-6">
          Every cycle
        </div>
        <h2 className="text-[36px] md:text-[48px] font-semibold tracking-tight leading-[1.05] text-white">
          Six steps, every time
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-slate-400 max-w-xl mx-auto">
          Intelligence proposes. Infrastructure executes. Kite verifies.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {STAGES.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 hover:border-white/[0.12] transition-all"
          >
            <div className={`font-mono text-[11px] font-bold ${s.color} mb-3`}>{s.num}</div>
            <h3 className="text-[16px] font-semibold text-white mb-2">{s.title}</h3>
            <p className="text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Pipeline bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-8 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 border border-white/[0.06] p-6"
      >
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
          {['Intent', 'LLM', 'Risk', 'Simulate', 'Execute', 'Attest'].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[13px] font-medium text-slate-300">
                {label}
              </div>
              {i < 5 && <span className="text-slate-600 hidden md:block">→</span>}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
