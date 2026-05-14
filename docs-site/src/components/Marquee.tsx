interface Logo {
  name: string
  src: string
}

// Real AI models + DeFi protocols only — no messaging apps
const LOGOS: Logo[] = [
  // AI Models
  { name: 'Claude', src: 'https://svgl.app/library/claude-ai.svg' },
  { name: 'OpenAI', src: 'https://svgl.app/library/openai.svg' },
  { name: 'DeepSeek', src: 'https://svgl.app/library/deepseek.svg' },
  { name: 'Google Gemini', src: 'https://svgl.app/library/google-gemini.svg' },
  { name: 'Meta Llama', src: 'https://svgl.app/library/meta.svg' },
  // DeFi Protocols
  { name: 'Aave', src: 'https://svgl.app/library/aave.svg' },
  { name: 'Uniswap', src: 'https://svgl.app/library/uniswap.svg' },
  // Chains
  { name: 'Arbitrum', src: 'https://svgl.app/library/arbitrum.svg' },
  { name: 'Base', src: 'https://svgl.app/library/base.svg' },
  { name: 'Avalanche', src: 'https://svgl.app/library/avalanche.svg' },
]

export default function Marquee () {
  return (
    <div className="mt-24 max-w-[1200px] mx-auto px-6">
      <div className="text-center mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          AI Models &amp; Protocols
        </p>
      </div>
      <div
        className="overflow-hidden marquee-pause"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)'
        }}
      >
        <div className="marquee-track flex gap-4 w-max">
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <div
              key={i}
              className="h-16 w-36 shrink-0 flex items-center justify-center gap-2.5 rounded-xl bg-[#0f1d32] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <img
                src={logo.src}
                alt={logo.name}
                className="h-5 w-5 object-contain opacity-70"
              />
              <span className="text-[12px] font-medium text-slate-400">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
