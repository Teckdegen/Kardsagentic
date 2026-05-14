import HlsVideo from './HlsVideo'

const FOOTER_VIDEO = 'https://customer-cbeadsgr09pnsezs.cloudflarestream.com/12a9780eeb1ea015801a5f55cf2e9d3d/manifest/video.m3u8'
const FOOTER_MP4 = 'https://customer-cbeadsgr09pnsezs.cloudflarestream.com/12a9780eeb1ea015801a5f55cf2e9d3d/downloads/default.mp4'

export default function Footer () {
  return (
    <footer className="max-w-[1200px] mx-auto px-6 pt-32 pb-12">
      {/* Video CTA section */}
      <div className="relative rounded-2xl overflow-hidden border border-[#1a1a1a]">
        {/* HLS Video background */}
        <div className="absolute inset-0">
          <HlsVideo
            src={FOOTER_VIDEO}
            fallbackMp4={FOOTER_MP4}
            className="w-full h-full object-cover grayscale"
          />
        </div>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Content */}
        <div className="relative z-10 p-12 md:p-20 text-center">
          <h3 className="text-[28px] md:text-[36px] font-bold text-white">
            Build Faster. Trade Smarter.
          </h3>
          <p className="mt-3 text-[15px] text-[#a1a1aa]">
            Try the Kard CLI today.
          </p>
          <div className="mt-8">
            <a
              href="#/docs"
              className="inline-flex px-6 py-3 rounded-lg bg-white text-black text-[14px] font-semibold hover:bg-[#e4e4e7] transition-colors"
            >
              Get started ↗
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-[#52525b]">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-4 h-4 object-contain opacity-40" />
          Kard — Agentic trading, settled on Kite AI
        </div>
        <div className="flex items-center gap-6">
          <span>Apache-2.0</span>
          <a href="https://github.com/Teckdegen/Kardsagentic" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          <a href="https://docs.gokite.ai" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Kite AI</a>
        </div>
      </div>
    </footer>
  )
}
