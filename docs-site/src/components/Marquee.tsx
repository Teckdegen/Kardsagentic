const LOGOS = [
  { name: 'Claude', src: 'https://svgl.app/library/claude-ai.svg' },
  { name: 'OpenAI', src: 'https://svgl.app/library/openai.svg' },
  { name: 'DeepSeek', src: 'https://svgl.app/library/deepseek.svg' },
  { name: 'Gemini', src: 'https://svgl.app/library/google-gemini.svg' },
  { name: 'Llama', src: 'https://svgl.app/library/meta.svg' },
  { name: 'Aave', src: 'https://svgl.app/library/aave.svg' },
  { name: 'Uniswap', src: 'https://svgl.app/library/uniswap.svg' },
  { name: 'Arbitrum', src: 'https://svgl.app/library/arbitrum.svg' },
  { name: 'Base', src: 'https://svgl.app/library/base.svg' },
]

export default function Marquee () {
  return (
    <div className="mt-20 max-w-[1200px] mx-auto">
      <div className="text-center mb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-600">
          Powered by
        </p>
      </div>
      <div
        className="overflow-hidden marquee-pause"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)'
        }}
      >
        <div className="marquee-track flex gap-6 w-max">
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-5 py-3 rounded-full glass hover:bg-white/[0.04] transition-all shrink-0"
            >
              <img src={logo.src} alt={logo.name} className="h-4 w-4 object-contain opacity-60" />
              <span className="text-[12px] font-medium text-slate-500">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
