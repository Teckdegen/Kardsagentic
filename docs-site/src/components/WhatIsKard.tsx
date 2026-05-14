import { motion } from 'motion/react'
import {
  Brain, Shield, Lock, MessageSquare, TrendingUp, Zap, Code2, Sparkles
} from 'lucide-react'

const FEATURES = [
  {
    icon: Brain,
    title: 'Text → On-chain',
    body: 'Write a strategy in plain English. The AI compiles it into a structured plan. Deterministic infrastructure validates and executes it. Zero code required.',
    accent: 'from-blue-500/20 to-blue-600/5'
  },
  {
    icon: Shield,
    title: 'Kite-attested',
    body: 'Every action emits a verifiable attestation on Kite AI (chainId 2366). Cryptographically signed, timestamped, permanently on-chain. Anyone can verify.',
    accent: 'from-purple-500/20 to-purple-600/5'
  },
  {
    icon: Lock,
    title: 'Self-custodial',
    body: 'Your keys live encrypted on your machine. Kite Passport gates spending with passkey-approved sessions. The agent never holds your funds.',
    accent: 'from-emerald-500/20 to-emerald-600/5'
  },
  {
    icon: Sparkles,
    title: 'Bring your own model',
    body: 'Claude, GPT, DeepSeek, Grok, Gemini, OpenRouter, or local Ollama. Mix providers across agents in a fleet. Switch any time.',
    accent: 'from-amber-500/20 to-amber-600/5'
  },
  {
    icon: TrendingUp,
    title: '11 yield rails',
    body: 'Aave, Lucid L-USDC on Kite, Morpho Blue, Compound, Pendle, Lido, EtherFi, Beefy, Uniswap V3 LP, Aerodrome, Hyperliquid perps. Ranked every cycle.',
    accent: 'from-cyan-500/20 to-cyan-600/5'
  },
  {
    icon: Zap,
    title: 'Self-evolving',
    body: 'After 50 profitable cycles in the same pattern, the agent writes a skill file capturing the heuristic and shares it with peer agents in your fleet.',
    accent: 'from-rose-500/20 to-rose-600/5'
  },
  {
    icon: MessageSquare,
    title: 'Telegram / Discord / Slack',
    body: 'Drop a bot token, the daemon picks it up. Message your agent from your phone. Full natural language — not slash commands.',
    accent: 'from-indigo-500/20 to-indigo-600/5'
  },
  {
    icon: Code2,
    title: '.md skills',
    body: 'Drop a markdown file in ~/.kard/skills/. Agent learns a new API or venue on next reload. Built-in: CoinGecko, DeFiLlama, Pyth, Etherscan, and more.',
    accent: 'from-teal-500/20 to-teal-600/5'
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] font-semibold text-slate-400 mb-6">
          <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
            <img src="/logo.png" alt="" className="w-2.5 h-2.5 object-contain invert" />
          </span>
          What Kard does
        </div>
        <h2 className="text-[36px] md:text-[52px] font-semibold tracking-tight leading-[1.05] text-white">
          The runtime between<br />
          <span className="gradient-text">intent and execution</span>
        </h2>
        <p className="mt-6 max-w-2xl mx-auto text-[15px] md:text-[16px] leading-relaxed text-slate-400">
          Kard isn't a trading bot. It's the deterministic infrastructure AI agents need
          to actually move money — text in, plan compiled, risk vetted, transaction signed,
          receipt attested on Kite AI. Self-hosted. Your rules. Your keys.
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

function FeatureCard ({ icon: Icon, title, body, accent, idx }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: idx * 0.05 }}
      className="group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all card-glow"
    >
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center group-hover:border-white/[0.15] transition-colors">
          <Icon size={18} strokeWidth={1.5} className="text-slate-300" />
        </div>
        <h3 className="mt-4 text-[15px] font-semibold text-white">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500 group-hover:text-slate-400 transition-colors">{body}</p>
      </div>
    </motion.div>
  )
}
