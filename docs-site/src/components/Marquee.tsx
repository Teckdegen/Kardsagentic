interface Logo {
  src: string
  alt: string
}

const LOGOS: Logo[] = [
  { src: 'https://svgl.app/library/arbitrum.svg', alt: 'Arbitrum' },
  { src: 'https://svgl.app/library/base.svg', alt: 'Base' },
  { src: 'https://svgl.app/library/avalanche.svg', alt: 'Avalanche' },
  { src: 'https://svgl.app/library/aave.svg', alt: 'Aave' },
  { src: 'https://svgl.app/library/uniswap.svg', alt: 'Uniswap' },
  { src: 'https://svgl.app/library/claude-ai.svg', alt: 'Claude' },
  { src: 'https://svgl.app/library/openai.svg', alt: 'OpenAI' },
  { src: 'https://svgl.app/library/telegram.svg', alt: 'Telegram' },
]

export default function Marquee () {
  return (
    <div className="mt-24 max-w-[1200px] mx-auto px-6">
      <div className="text-center mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          Integrated protocols &amp; models
        </p>
      </div>
      <div
        className="overflow-hidden marquee-pause"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)'
        }}
      >
        <div className="marquee-track flex gap-5 w-max">
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <div
              key={i}
              className="h-14 w-32 shrink-0 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all"
            >
              <img
                src={logo.src}
                alt={logo.alt}
                className="max-h-5 max-w-[50%] object-contain opacity-50 hover:opacity-80 transition-opacity invert"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
