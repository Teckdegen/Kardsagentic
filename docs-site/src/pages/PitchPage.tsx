import { useState, useEffect } from 'react'

const SLIDES = [
  // Slide 1: Title / Hook
  {
    id: 'title',
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="mb-8">
          <img src="/logo.png" alt="Kard" className="w-16 h-16 mx-auto mb-6 object-contain" />
        </div>
        <h1 className="text-[56px] md:text-[80px] font-black text-white leading-[0.95] tracking-[-0.03em] mb-6">
          KARD
        </h1>
        <p className="text-[22px] md:text-[28px] text-[#a1a1aa] font-light max-w-[700px] leading-[1.4] mb-10">
          The autonomous trading runtime for AI agents.
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-[14px] text-[#52525b]">
          <span className="px-4 py-2 rounded-full border border-[#1a1a1a]">Text to Onchain</span>
          <span className="px-4 py-2 rounded-full border border-[#1a1a1a]">Kite AI Native</span>
          <span className="px-4 py-2 rounded-full border border-[#1a1a1a]">Verifiable Execution</span>
        </div>
      </div>
    )
  },

  // Slide 2: Problem
  {
    id: 'problem',
    content: (
      <div className="flex flex-col justify-center h-full px-8 md:px-16 max-w-[900px] mx-auto">
        <p className="text-[13px] uppercase tracking-[0.2em] text-[#52525b] mb-6">The Problem</p>
        <h2 className="text-[36px] md:text-[48px] font-bold text-white leading-[1.1] mb-10">
          DeFi is too complex for humans to operate 24/7.
        </h2>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <span className="text-[24px]">⏱</span>
            <div>
              <p className="text-[16px] text-white font-medium">Yield shifts every minute</p>
              <p className="text-[14px] text-[#71717a]">Best rates move across 8+ protocols and 5+ chains constantly. No human can monitor them all.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-[24px]">🔒</span>
            <div>
              <p className="text-[16px] text-white font-medium">Existing bots are black boxes</p>
              <p className="text-[14px] text-[#71717a]">No verifiable record of what they did or why. Users trust blindly or don't trust at all.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-[24px]">🧠</span>
            <div>
              <p className="text-[16px] text-white font-medium">AI agents lack financial infrastructure</p>
              <p className="text-[14px] text-[#71717a]">LLMs can reason about markets but have no runtime to safely execute, attest, and learn from trades.</p>
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
      <div className="flex flex-col justify-center h-full px-8 md:px-16 max-w-[900px] mx-auto">
        <p className="text-[13px] uppercase tracking-[0.2em] text-[#52525b] mb-6">The Solution</p>
        <h2 className="text-[36px] md:text-[48px] font-bold text-white leading-[1.1] mb-10">
          Say what you want. Kard executes and proves it.
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
            <p className="text-[28px] mb-3">💬</p>
            <p className="text-[15px] text-white font-medium mb-2">Natural Language In</p>
            <p className="text-[13px] text-[#71717a]">"Park my USDC at the highest yield" compiles into a structured strategy via any LLM.</p>
          </div>
          <div className="p-6 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
            <p className="text-[28px] mb-3">⚡</p>
            <p className="text-[15px] text-white font-medium mb-2">Multi-Chain Execution</p>
            <p className="text-[13px] text-[#71717a]">Executes across Aave, Hyperliquid, Uniswap, Morpho, Aerodrome, and more. Auto-bridges gas.</p>
          </div>
          <div className="p-6 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
            <p className="text-[28px] mb-3">🔗</p>
            <p className="text-[15px] text-white font-medium mb-2">Kite AI Attestation</p>
            <p className="text-[13px] text-[#71717a]">Every action is permanently recorded on Kite AI. Verifiable by anyone. Full transparency.</p>
          </div>
          <div className="p-6 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">
            <p className="text-[28px] mb-3">🏆</p>
            <p className="text-[15px] text-white font-medium mb-2">On-Chain Reputation</p>
            <p className="text-[13px] text-[#71717a]">Attestation history becomes a public trust score. Proven strategies carry cryptographic backtest proofs.</p>
          </div>
        </div>
      </div>
    )
  },

  // Slide 4: How It Works / Architecture
  {
    id: 'how',
    content: (
      <div className="flex flex-col justify-center h-full px-8 md:px-16 max-w-[900px] mx-auto">
        <p className="text-[13px] uppercase tracking-[0.2em] text-[#52525b] mb-6">How It Works</p>
        <h2 className="text-[32px] md:text-[40px] font-bold text-white leading-[1.1] mb-10">
          From English to execution in seconds.
        </h2>

        {/* Flow */}
        <div className="flex flex-col gap-1 mb-10">
          {[
            { step: '1', label: 'User speaks', desc: '"Long ETH if RSI drops below 30, risk 2%"' },
            { step: '2', label: 'LLM compiles', desc: 'Any provider (Claude, GPT, DeepSeek, Ollama) → structured actions' },
            { step: '3', label: 'Risk engine checks', desc: 'Hard limits on drawdown, leverage, position size. Cannot be overridden.' },
            { step: '4', label: 'Agent executes', desc: 'Swaps, lends, opens perps, bridges gas — all autonomous.' },
            { step: '5', label: 'Kite AI attests', desc: 'On-chain record: what, why, confidence, result. Permanent and verifiable.' },
          ].map(({ step, label, desc }) => (
            <div key={step} className="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-white/[0.02] transition-colors">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[13px] font-bold text-white shrink-0">{step}</span>
              <div>
                <span className="text-[14px] text-white font-medium">{label}</span>
                <span className="text-[13px] text-[#71717a] ml-2">{desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg border border-[#1a1a1a]">
            <p className="text-[24px] font-bold text-white">8+</p>
            <p className="text-[12px] text-[#52525b]">Protocols</p>
          </div>
          <div className="p-4 rounded-lg border border-[#1a1a1a]">
            <p className="text-[24px] font-bold text-white">5</p>
            <p className="text-[12px] text-[#52525b]">Chains</p>
          </div>
          <div className="p-4 rounded-lg border border-[#1a1a1a]">
            <p className="text-[24px] font-bold text-white">100</p>
            <p className="text-[12px] text-[#52525b]">Agents in Fleet</p>
          </div>
        </div>
      </div>
    )
  },

  // Slide 5: Traction / CTA
  {
    id: 'traction',
    content: (
      <div className="flex flex-col justify-center h-full px-8 md:px-16 max-w-[900px] mx-auto text-center">
        <p className="text-[13px] uppercase tracking-[0.2em] text-[#52525b] mb-6">Built and Shipping</p>
        <h2 className="text-[36px] md:text-[48px] font-bold text-white leading-[1.1] mb-10">
          Live on npm. Try it now.
        </h2>

        <div className="inline-block mx-auto mb-10 px-6 py-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-left">
          <code className="text-[14px] text-[#a1a1aa] font-mono">
            npm install -g kard-agent<br/>
            kard demo
          </code>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 text-center">
          <div>
            <p className="text-[28px] font-bold text-white">v0.2</p>
            <p className="text-[12px] text-[#52525b]">Published on npm</p>
          </div>
          <div>
            <p className="text-[28px] font-bold text-white">92</p>
            <p className="text-[12px] text-[#52525b]">Source Files</p>
          </div>
          <div>
            <p className="text-[28px] font-bold text-white">7</p>
            <p className="text-[12px] text-[#52525b]">LLM Providers</p>
          </div>
          <div>
            <p className="text-[28px] font-bold text-white">3</p>
            <p className="text-[12px] text-[#52525b]">Interfaces (CLI/SDK/MCP)</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <a href="https://github.com/Teckdegen/Kardsagentic" target="_blank" rel="noreferrer"
            className="px-6 py-3 rounded-full bg-white text-black text-[14px] font-medium hover:bg-white/90 transition-colors">
            GitHub
          </a>
          <a href="#/docs"
            className="px-6 py-3 rounded-full border border-[#333] text-white text-[14px] font-medium hover:bg-white/5 transition-colors">
            Documentation
          </a>
          <a href="https://www.npmjs.com/package/kard-agent" target="_blank" rel="noreferrer"
            className="px-6 py-3 rounded-full border border-[#333] text-white text-[14px] font-medium hover:bg-white/5 transition-colors">
            npm Package
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
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Slide content */}
      <div className="w-full h-full">
        {SLIDES[current].content}
      </div>

      {/* Navigation dots */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === current ? 'bg-white scale-125' : 'bg-[#333] hover:bg-[#555]'
            }`}
          />
        ))}
      </div>

      {/* Arrow buttons */}
      {current > 0 && (
        <button
          onClick={() => setCurrent(c => c - 1)}
          className="fixed left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
        >
          ←
        </button>
      )}
      {current < SLIDES.length - 1 && (
        <button
          onClick={() => setCurrent(c => c + 1)}
          className="fixed right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
        >
          →
        </button>
      )}

      {/* Slide counter + back link */}
      <div className="fixed top-6 left-6 flex items-center gap-4">
        <a href="#/" className="text-[12px] text-[#52525b] hover:text-white transition-colors">← Back</a>
        <span className="text-[12px] text-[#333]">{current + 1} / {SLIDES.length}</span>
      </div>

      {/* Keyboard hint */}
      <div className="fixed bottom-8 right-8 text-[11px] text-[#333]">
        ← → to navigate
      </div>
    </div>
  )
}
