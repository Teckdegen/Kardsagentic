import { motion } from 'motion/react'
import {
  Brain, Shield, Lock, MessageSquare, TrendingUp, Zap, Code2, Sparkles
} from 'lucide-react'

const FEATURES = [
  {
    icon: Brain,
    title: 'Text → On-chain',
    body: 'Write a strategy in plain English. The AI compiles it. Infrastructure validates and executes. Zero code.',
  },
  {
    icon: Shield,
    title: 'Kite-attested',
    body: 'Every action emits a verifiable attestation on Kite AI. Cryptographically signed, timestamped, permanent.',
  },
  {
    icon: Lock,
    title: 'Self-custodial',
    body: 'Your keys live encrypted on your machine. Kite Passport gates spending with passkey sessions.',
  },
  {
    icon: Sparkles,
    title: 'Bring your own model',
    body: 'Claude, GPT, DeepSeek, Grok, Gemini, Ollama. Mix providers across agents. Switch any time.',
  },
  {
    icon: TrendingUp,
    title: '11 yield rails',
    body: 'Aave, Lucid, Morpho, Compound, Pendle, Lido, EtherFi, Beefy, Uniswap V3, Aerodrome, Hyperliquid.',
  },
  {
    icon: Zap,
    title: 'Self-evolving',
    body: 'After 50 profitable cycles, the agent writes a skill file and shares it with peer agents in your fleet.',
  },
  {
    icon: MessageSquare,
    title: 'Chat control',
    body: 'Telegram, Discord, Slack. Message your agent from your phone in natural language. Full AI chatbot.',
  },
  {
    icon: Code2,
    title: '.md skills',
    body: 'Drop a markdown file. Agent learns a new API or venue on next reload. Extensible by design.',
  }
]

export default function WhatIsKard () {
  return (
    <section id="what-is-kard" className="max-w-[1200px] mx-auto mt-32 px-6 md:px-12 scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0f1d32] border border-white/[0.06] text-[11px] font-semibold text-slate-400 mb-6">
          <img src="/logo.png" alt="" className="w-3 h-3 object-contain" />
          What Kard does
        </div>
        <h2 className="text-[36px] md:text-[52px] font-bold tracking-tight leading-[1.05] text-white">
          The runtime between<br />
          <span className="gradient-text">intent and execution</span>
        </h2>
        <p className="mt-6 max-w-2xl mx-auto text-[15px] md:text-[16px] leading-relaxed text-slate-400">
          Kard isn't a trading bot. It's the deterministic infrastructure AI agents need
          to move money — text in, plan compiled, risk vetted, transaction signed,
          receipt attested on Kite AI.
        </p>
      </motion.div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {FEATURES.map((f, i) => (
          <FeatureCard key={i} idx={i} {...f} />
        ))}
      </div>
    </section>
  )
}

function FeatureCard ({ icon: Icon, title, body, idx }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: idx * 0.05 }}
      className="group rounded-2xl bg-[#0f1d32] border border-white/[0.06] p-6 card-hover"
    >
      <div className="w-10 h-10 rounded-xl bg-[#152540] border border-white/[0.06] flex items-center justify-center group-hover:border-blue-500/30 transition-colors">
        <Icon size={18} strokeWidth={1.5} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-white">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-500 group-hover:text-slate-400 transition-colors">{body}</p>
    </motion.div>
  )
}
