import { useState, useEffect } from 'react'

// ─── SVG Icons ───
const IconClock = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
)
const IconLock = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const IconBrain = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><path d="M9 21h6"/><path d="M10 17v4"/><path d="M14 17v4"/>
  </svg>
)
const IconMessage = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconZap = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const IconLink = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const SLIDES = [
  // ─── Slide 1: Title ───
  {
    id: 'title',
    content: (
      <div className="h-screen w-full flex flex-col items-center justify-center px-6">
        <img src="/logo.png" alt="Kard" className="w-14 h-14 object-contain mb-8 opacity-90" />
        <h1 className="text-[48px] md:text-[72px] font-black text-white tracking-[-0.04em] leading-[1] mb-4">
          KARD
        </h1>
        <p className="text-[18px] md:text-[24px] text-[#71717a] font-light max-w-[600px] text-center leading-[1.5] mb-12">
          The autonomous trading runtime for AI agents.<br/>
          Built natively on Kite AI.
        </p>
        <div className="flex gap-6 text-[13px] text-[#52525b]">
          <span>Text to Onchain</span>
          <span className="text-[#333]">|</span>
          <span>Verifiable Execution</span>
          <span className="text-[#333]">|</span>
          <span>On-Chain Reputation</span>
        </div>
      </div>
    )
  },

  // ─── Slide 2: Problem ───
  {
    id: 'problem',
    content: (
      <div className="h-screen w-full flex flex-col justify-center px-8 md:px-20 max-w-[860px] mx-auto">
        <p className="text-[12px] uppercase tracking-[0.2em] text-[#444] mb-4 font-medium">The Problem</p>
        <h2 className="text-[28px] md:text-[40px] font-bold text-white leading-[1.15] mb-8 tracking-[-0.02em]">
          DeFi is too complex for humans<br/>to operate around the clock.
        </h2>
        <div className="space-y-5">
          <div className="flex items-start gap-4 p-4 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="text-[#71717a] mt-0.5"><IconClock /></div>
            <div>
              <p className="text-[14px] text-white font-medium mb-1">Yield shifts every minute</p>
              <p className="text-[13px] text-[#52525b] leading-[1.5]">Best rates move across 8+ protocols and 5+ chains. No human can monitor and rebalance continuously.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="text-[#71717a] mt-0.5"><IconLock /></div>
            <div>
              <p className="text-[14px] text-white font-medium mb-1">Existing bots are black boxes</p>
              <p className="text-[13px] text-[#52525b] leading-[1.5]">No verifiable record of decisions. Users trust blindly or avoid automation entirely.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="text-[#71717a] mt-0.5"><IconBrain /></div>
            <div>
              <p className="text-[14px] text-white font-medium mb-1">AI agents lack financial infrastructure</p>
              <p className="text-[13px] text-[#52525b] leading-[1.5]">LLMs can reason about markets but have no runtime to safely execute, attest, and learn.</p>
            </div>
          </div>
        </div>
      </div>
    )
  },

  // ─── Slide 3: Solution ───
  {
    id: 'solution',
    content: (
      <div className="h-screen w-full flex flex-col justify-center px-8 md:px-20 max-w-[860px] mx-auto">
        <p className="text-[12px] uppercase tracking-[0.2em] text-[#444] mb-4 font-medium">The Solution</p>
        <h2 className="text-[28px] md:text-[40px] font-bold text-white leading-[1.15] mb-8 tracking-[-0.02em]">
          Say what you want.<br/>Kard executes and proves it on-chain.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="text-[#71717a] mb-3"><IconMessage /></div>
            <p className="text-[14px] text-white font-medium mb-1">Natural Language In</p>
            <p className="text-[12px] text-[#52525b] leading-[1.5]">Plain English compiles into structured strategies via any LLM provider.</p>
          </div>
          <div className="p-5 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="text-[#71717a] mb-3"><IconZap /></div>
            <p className="text-[14px] text-white font-medium mb-1">Multi-Chain Execution</p>
            <p className="text-[12px] text-[#52525b] leading-[1.5]">Aave, Hyperliquid, Uniswap, Morpho, Aerodrome. Auto-bridges gas across chains.</p>
          </div>
          <div className="p-5 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="text-[#71717a] mb-3"><IconLink /></div>
            <p className="text-[14px] text-white font-medium mb-1">Kite AI Attestation</p>
            <p className="text-[12px] text-[#52525b] leading-[1.5]">Every action permanently recorded on Kite AI. Verifiable by anyone, forever.</p>
          </div>
          <div className="p-5 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="text-[#71717a] mb-3"><IconShield /></div>
            <p className="text-[14px] text-white font-medium mb-1">On-Chain Reputation</p>
            <p className="text-[12px] text-[#52525b] leading-[1.5]">Attestation history becomes a trust score. Strategies carry cryptographic backtest proofs.</p>
          </div>
        </div>
      </div>
    )
  },

  // ─── Slide 4: How It Works ───
  {
    id: 'how',
    content: (
      <div className="h-screen w-full flex flex-col justify-center px-8 md:px-20 max-w-[860px] mx-auto">
        <p className="text-[12px] uppercase tracking-[0.2em] text-[#444] mb-4 font-medium">Architecture</p>
        <h2 className="text-[28px] md:text-[36px] font-bold text-white leading-[1.15] mb-8 tracking-[-0.02em]">
          From English to execution in seconds.
        </h2>
        <div className="space-y-2 mb-8">
          {[
            ['01', 'User speaks', '"Park my USDC at the highest yield"'],
            ['02', 'LLM compiles', 'Claude, GPT, DeepSeek, or Ollama → structured actions'],
            ['03', 'Risk engine validates', 'Hard limits on drawdown, leverage, position size'],
            ['04', 'Agent executes', 'Swaps, lends, opens perps, bridges — all autonomous'],
            ['05', 'Kite AI attests', 'Permanent on-chain record of what, why, and result'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex items-center gap-4 py-3 px-4 rounded-lg border border-[#111] bg-[#060606]">
              <span className="text-[12px] font-mono text-[#333] w-6 shrink-0">{num}</span>
              <span className="text-[13px] text-white font-medium w-[160px] shrink-0">{title}</span>
              <span className="text-[12px] text-[#52525b]">{desc}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-6 justify-center">
          <div className="text-center">
            <p className="text-[22px] font-bold text-white">8+</p>
            <p className="text-[11px] text-[#444] uppercase tracking-wider">Protocols</p>
          </div>
          <div className="w-px bg-[#1a1a1a]" />
          <div className="text-center">
            <p className="text-[22px] font-bold text-white">5</p>
            <p className="text-[11px] text-[#444] uppercase tracking-wider">Chains</p>
          </div>
          <div className="w-px bg-[#1a1a1a]" />
          <div className="text-center">
            <p className="text-[22px] font-bold text-white">100</p>
            <p className="text-[11px] text-[#444] uppercase tracking-wider">Agent Fleet</p>
          </div>
          <div className="w-px bg-[#1a1a1a]" />
          <div className="text-center">
            <p className="text-[22px] font-bold text-white">7</p>
            <p className="text-[11px] text-[#444] uppercase tracking-wider">LLM Providers</p>
          </div>
        </div>
      </div>
    )
  },

  // ─── Slide 5: CTA ───
  {
    id: 'cta',
    content: (
      <div className="h-screen w-full flex flex-col items-center justify-center px-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-[#444] mb-4 font-medium">Live and Shipping</p>
        <h2 className="text-[32px] md:text-[44px] font-bold text-white leading-[1.15] mb-6 tracking-[-0.02em] text-center">
          Try it in 30 seconds.
        </h2>
        <div className="px-6 py-4 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] mb-10">
          <code className="text-[13px] text-[#a1a1aa] font-mono leading-[2]">
            <span className="text-[#444]">$</span> npm install -g kard-agent<br/>
            <span className="text-[#444]">$</span> kard demo
          </code>
        </div>
        <div className="flex gap-8 mb-12">
          {[
            ['v0.2', 'npm'],
            ['92', 'Files'],
            ['CLI + SDK + MCP', 'Interfaces'],
          ].map(([val, label]) => (
            <div key={label} className="text-center">
              <p className="text-[18px] font-bold text-white">{val}</p>
              <p className="text-[11px] text-[#444] uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <a href="https://github.com/Teckdegen/Kardsagentic" target="_blank" rel="noreferrer"
            className="px-5 py-2.5 rounded-lg bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
            GitHub
          </a>
          <a href="#/docs"
            className="px-5 py-2.5 rounded-lg border border-[#222] text-white text-[13px] font-medium hover:bg-white/5 transition-colors">
            Docs
          </a>
          <a href="https://www.npmjs.com/package/kard-agent" target="_blank" rel="noreferrer"
            className="px-5 py-2.5 rounded-lg border border-[#222] text-white text-[13px] font-medium hover:bg-white/5 transition-colors">
            npm
          </a>
        </div>
      </div>
    )
  }
]

export default function PitchPage () {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setCurrent(c => Math.min(c + 1, SLIDES.length - 1))
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrent(c => Math.max(c - 1, 0))
      }
      if (e.key === 'Escape') {
        window.location.hash = '#/'
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* Slide */}
      <div className="w-full h-full overflow-hidden">
        {SLIDES[current].content}
      </div>

      {/* Dots */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all duration-200 ${
              i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-[#333] hover:bg-[#555]'
            }`}
          />
        ))}
      </div>

      {/* Arrows */}
      {current > 0 && (
        <button
          onClick={() => setCurrent(c => c - 1)}
          className="fixed left-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-[#222] flex items-center justify-center text-[#555] hover:text-white hover:border-[#444] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      )}
      {current < SLIDES.length - 1 && (
        <button
          onClick={() => setCurrent(c => c + 1)}
          className="fixed right-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-[#222] flex items-center justify-center text-[#555] hover:text-white hover:border-[#444] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      )}

      {/* Top bar */}
      <div className="fixed top-5 left-5 right-5 flex items-center justify-between">
        <a href="#/" className="text-[11px] text-[#333] hover:text-white transition-colors font-mono">ESC</a>
        <span className="text-[11px] text-[#333] font-mono">{current + 1}/{SLIDES.length}</span>
      </div>
    </div>
  )
}
