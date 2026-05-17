import { useState, useEffect } from 'react'

// ─── SVG Icons ───

function IconClock ({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function IconLock ({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function IconBrain ({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><path d="M10 21h4"/>
    </svg>
  )
}

function IconMessage ({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function IconZap ({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function IconLink ({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}

function IconShield ({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function IconTrophy ({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  )
}

// ─── Slides ───

const SLIDES = [
  // Slide 1: Title
  {
    id: 'title',
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <img src="/logo.png" alt="Kard" className="w-14 h-14 mb-8 object-contain" />
        <h1 className="text-[48px] md:text-[72px] font-black text-white leading-[0.95] tracking-[-0.04em] mb-5">
          KARD
        </h1>
        <p className="text-[20px] md:text-[26px] text-[#a1a1aa] font-light max-w-[600px] leading-[1.4] mb-8">
          The autonomous trading runtime for AI agents.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-[13px] text-[#71717a]">
          <span className="px-4 py-2 rounded-full border border-[#222]">Text to Onchain</span>
          <span className="px-4 py-2 rounded-full border border-[#222]">Kite AI Native</span>
          <span className="px-4 py-2 rounded-full border border-[#222]">Verifiable Execution</span>
        </div>
      </div>
    )
  },

  // Slide 2: Problem
  {
    id: 'problem',
    content: (
      <div className="flex flex-col justify-center h-full px-6 md:px-12 max-w-[800px] mx-auto">
        <p className="text-[12px] uppercase tracking-[0.2em] text-[#52525b] mb-4">The Problem</p>
        <h2 className="text-[28px] md:text-[40px] font-bold text-white leading-[1.1] mb-8">
          DeFi is too complex for humans to operate 24/7.
        </h2>
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-[#222] flex items-center justify-center shrink-0">
              <IconClock className="w-5 h-5 text-[#a1a1aa]" />
            </div>
            <div>
              <p className="text-[15px] text-white font-medium mb-1">Yield shifts every minute</p>
              <p className="text-[13px] text-[#71717a] leading-relaxed">Best rates move across 8+ protocols and 5+ chains constantly. No human can monitor them all.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-[#222] flex items-center justify-center shrink-0">
              <IconLock className="w-5 h-5 text-[#a1a1aa]" />
            </div>
            <div>
              <p className="text-[15px] text-white font-medium mb-1">Existing bots are black boxes</p>
              <p className="text-[13px] text-[#71717a] leading-relaxed">No verifiable record of what they did or why. Users trust blindly or don't trust at all.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-[#222] flex items-center justify-center shrink-0">
              <IconBrain className="w-5 h-5 text-[#a1a1aa]" />
            </div>
            <div>
              <p className="text-[15px] text-white font-medium mb-1">AI agents lack financial infrastructure</p>
              <p className="text-[13px] text-[#71717a] leading-relaxed">LLMs can reason about markets but have no runtime to safely execute, attest, and learn.</p>
            </div>
          </div>
        </div>
      </div>
    )
  },

  // Slide 3: Solution
  {
    id: 'solution',
    content: (
      <div className="flex flex-col justify-center h-full px-6 md:px-12 max-w-[800px] mx-auto">
        <p className="text-[12px] uppercase tracking-[0.2em] text-[#52525b] mb-4">The Solution</p>
        <h2 className="text-[28px] md:text-[40px] font-bold text-white leading-[1.1] mb-8">
          Say what you want. Kard executes and proves it.
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-xl border border-[#1a1a1a] bg-[#080808]">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-[#222] flex items-center justify-center mb-3">
              <IconMessage className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <p className="text-[14px] text-white font-medium mb-1">Natural Language In</p>
            <p className="text-[12px] text-[#71717a] leading-relaxed">Plain English compiles into structured strategies via any LLM provider.</p>
          </div>
          <div className="p-5 rounded-xl border border-[#1a1a1a] bg-[#080808]">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-[#222] flex items-center justify-center mb-3">
              <IconZap className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <p className="text-[14px] text-white font-medium mb-1">Multi-Chain Execution</p>
            <p className="text-[12px] text-[#71717a] leading-relaxed">Executes across Aave, Hyperliquid, Uniswap, Morpho, and more.</p>
          </div>
          <div className="p-5 rounded-xl border border-[#1a1a1a] bg-[#080808]">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-[#222] flex items-center justify-center mb-3">
              <IconLink className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <p className="text-[14px] text-white font-medium mb-1">Kite AI Attestation</p>
            <p className="text-[12px] text-[#71717a] leading-relaxed">Every action permanently recorded on-chain. Verifiable by anyone.</p>
          </div>
          <div className="p-5 rounded-xl border border-[#1a1a1a] bg-[#080808]">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-[#222] flex items-center justify-center mb-3">
              <IconTrophy className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <p className="text-[14px] text-white font-medium mb-1">On-Chain Reputation</p>
            <p className="text-[12px] text-[#71717a] leading-relaxed">Attestation history becomes a trust score. Strategies carry cryptographic proofs.</p>
          </div>
        </div>
      </div>
    )
  },

  // Slide 4: How It Works
  {
    id: 'how',
    content: (
      <div className="flex flex-col justify-center h-full px-6 md:px-12 max-w-[800px] mx-auto">
        <p className="text-[12px] uppercase tracking-[0.2em] text-[#52525b] mb-4">How It Works</p>
        <h2 className="text-[26px] md:text-[36px] font-bold text-white leading-[1.1] mb-6">
          From English to execution in seconds.
        </h2>
        <div className="space-y-1 mb-8">
          {[
            { step: '1', label: 'User speaks', desc: '"Long ETH if RSI < 30, risk 2%"' },
            { step: '2', label: 'LLM compiles', desc: 'Claude, GPT, DeepSeek, or Ollama structures the intent' },
            { step: '3', label: 'Risk engine checks', desc: 'Hard limits on drawdown, leverage, position size' },
            { step: '4', label: 'Agent executes', desc: 'Swaps, lends, opens perps, bridges gas autonomously' },
            { step: '5', label: 'Kite AI attests', desc: 'Permanent on-chain record of what, why, and result' },
          ].map(({ step, label, desc }) => (
            <div key={step} className="flex items-center gap-3 py-2.5 px-3 rounded-lg">
              <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[12px] font-bold text-white shrink-0">{step}</span>
              <span className="text-[13px] text-white font-medium w-[120px] shrink-0">{label}</span>
              <span className="text-[12px] text-[#71717a]">{desc}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-[#1a1a1a] text-center">
            <p className="text-[22px] font-bold text-white">8+</p>
            <p className="text-[11px] text-[#52525b]">Protocols</p>
          </div>
          <div className="p-3 rounded-lg border border-[#1a1a1a] text-center">
            <p className="text-[22px] font-bold text-white">5</p>
            <p className="text-[11px] text-[#52525b]">Chains</p>
          </div>
          <div className="p-3 rounded-lg border border-[#1a1a1a] text-center">
            <p className="text-[22px] font-bold text-white">100</p>
            <p className="text-[11px] text-[#52525b]">Agent Fleet</p>
          </div>
        </div>
      </div>
    )
  },

  // Slide 5: Traction / CTA
  {
    id: 'traction',
    content: (
      <div className="flex flex-col items-center justify-center h-full px-6 md:px-12 max-w-[800px] mx-auto text-center">
        <p className="text-[12px] uppercase tracking-[0.2em] text-[#52525b] mb-4">Built and Shipping</p>
        <h2 className="text-[28px] md:text-[40px] font-bold text-white leading-[1.1] mb-8">
          Live on npm. Try it now.
        </h2>

        <div className="mb-8 px-5 py-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] inline-block">
          <code className="text-[13px] text-[#a1a1aa] font-mono">
            npm install -g kard-agent && kard demo
          </code>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-8 w-full max-w-[500px]">
          <div>
            <p className="text-[22px] font-bold text-white">v0.2</p>
            <p className="text-[11px] text-[#52525b]">npm</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-white">92</p>
            <p className="text-[11px] text-[#52525b]">Files</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-white">7</p>
            <p className="text-[11px] text-[#52525b]">LLM Providers</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-white">3</p>
            <p className="text-[11px] text-[#52525b]">Interfaces</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <a href="https://github.com/Teckdegen/Kardsagentic" target="_blank" rel="noreferrer"
            className="px-5 py-2.5 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
            GitHub
          </a>
          <a href="#/docs"
            className="px-5 py-2.5 rounded-full border border-[#333] text-white text-[13px] font-medium hover:bg-white/5 transition-colors">
            Documentation
          </a>
          <a href="https://www.npmjs.com/package/kard-agent" target="_blank" rel="noreferrer"
            className="px-5 py-2.5 rounded-full border border-[#333] text-white text-[13px] font-medium hover:bg-white/5 transition-colors">
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
      <div className="w-full h-full">
        {SLIDES[current].content}
      </div>

      {/* Dots */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              i === current ? 'bg-white w-6' : 'bg-[#333] hover:bg-[#555]'
            }`}
          />
        ))}
      </div>

      {/* Arrows */}
      {current > 0 && (
        <button
          onClick={() => setCurrent(c => c - 1)}
          className="fixed left-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#71717a] hover:text-white transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
        </button>
      )}
      {current < SLIDES.length - 1 && (
        <button
          onClick={() => setCurrent(c => c + 1)}
          className="fixed right-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#71717a] hover:text-white transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4"/></svg>
        </button>
      )}

      {/* Top bar */}
      <div className="fixed top-5 left-5 flex items-center gap-4">
        <a href="#/" className="text-[11px] text-[#52525b] hover:text-white transition-colors">Back</a>
        <span className="text-[11px] text-[#333]">{current + 1}/{SLIDES.length}</span>
      </div>
    </div>
  )
}
