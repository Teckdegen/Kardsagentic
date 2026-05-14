import { motion } from 'motion/react'
import {
  Brain, Shield, Lock, Sparkles, TrendingUp, Zap, MessageSquare, Code2
} from 'lucide-react'

const FEATURES = [
  {
    icon: Brain,
    title: 'Text → On-chain',
    body: 'Write a strategy in plain English. AI compiles. Infrastructure executes. Zero code.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Shield,
    title: 'Kite-attested',
    body: 'Every action → verifiable attestation on Kite AI. Signed, timestamped, permanent.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: Lock,
    title: 'Self-custodial',
    body: 'Keys encrypted on your machine. Kite Passport gates spending with passkey sessions.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Sparkles,
    title: 'Any AI model',
    body: 'Claude, GPT, DeepSeek, Grok, Gemini, Ollama. Mix across agents. Switch any time.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: TrendingUp,
    title: '11 yield sources',
    body: 'Aave, Lucid, Morpho, Compound, Pendle, Lido, Beefy, Uniswap V3, Aerodrome, Hyperliquid.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Zap,
    title: 'Self-evolving',
    body: '50 profitable cycles → agent writes a skill file and shares it with your fleet.',
    gradient: 'from-rose-500 to-red-500',
  },
  {
    icon: MessageSquare,
    title: 'Phone control',
    body: 'Telegram, Discord, Slack. Full natural language. Not slash commands.',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    icon: Code2,
    title: 'Skill plugins',
    body: 'Drop a .md file → agent learns a new API. Built-in: CoinGecko, DeFiLlama, Pyth.',
    gradient: 'from-teal-500 to-emerald-500',
  }
]

export default function WhatIsKard () {
  return (
    <section id="features" className="max-w-[1200px] mx-auto mt-32 px-5 md:px-10 scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <h2 className="text-[40px] md:text-[56px] font-extrabold tracking-[-0.03em] leading-[1.0] text-white">
          Everything you need
        </h2>
        <p className="mt-5 text-[16px] leading-relaxed text-slate-400">
          From intent to execution to proof — in one self-hosted runtime.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="group gradient-border shine-hover rounded-[20px] p-6 hover:bg-white/[0.03] transition-all"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-lg opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all`}>
              <f.icon size={18} strokeWidth={2} className="text-white" />
            </div>
            <h3 className="mt-5 text-[15px] font-bold text-white">{f.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500 group-hover:text-slate-400 transition-colors">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
