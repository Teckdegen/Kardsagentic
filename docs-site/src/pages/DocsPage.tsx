import { useState, useEffect } from 'react'
import Docs from '../components/Docs'

const NAV = [
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'demo', label: 'Demo' },
  { id: 'install', label: 'Installation' },
  { id: 'wallet', label: 'Wallet Setup' },
  { id: 'llm', label: 'LLM Configuration' },
  { id: 'funding', label: 'Funding (Testnet)' },
  { id: 'first-run', label: 'First Run' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'strategy-marketplace', label: 'Strategy Marketplace' },
  { id: 'policy', label: 'Safety & Policy' },
  { id: 'risk-limits', label: 'Risk Limits' },
  { id: 'yields', label: 'Yield Opportunities' },
  { id: 'attestations', label: 'Attestations' },
  { id: 'reputation', label: 'Reputation' },
  { id: 'fleet', label: 'Multi-Agent Fleet' },
  { id: 'chat', label: 'Telegram / Discord' },
  { id: 'perps', label: 'Perps Trading' },
  { id: 'skills', label: 'Skills System' },
  { id: 'backtest', label: 'Backtesting' },
  { id: 'passport', label: 'Wallet & Passport' },
  { id: 'mcp', label: 'MCP Server' },
  { id: 'deploy', label: 'Deploy 24/7' },
  { id: 'mainnet', label: 'Go Mainnet' },
  { id: 'rpc', label: 'Custom RPC Endpoints' },
  { id: 'all-commands', label: 'All Commands' },
]

export default function DocsPage () {
  const [active, setActive] = useState('quickstart')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )
    for (const item of NAV) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen flex bg-black">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-[240px] shrink-0 fixed top-0 left-0 h-screen border-r border-[#111]">
        <div className="p-5 flex items-center gap-2.5">
          <img src="/logo.png" alt="Kard" className="w-5 h-5 object-contain opacity-80" />
          <span className="text-[13px] font-semibold text-white tracking-[-0.01em]">Kard</span>
          <span className="text-[11px] text-[#333] font-mono ml-auto">v0.2</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map(item => (
            <a
              key={item.id}
              href={`#/docs`}
              onClick={(e) => {
                e.preventDefault()
                setActive(item.id)
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className={`block px-3 py-1.5 rounded-md text-[12px] transition-all duration-150 ${
                active === item.id
                  ? 'text-white bg-white/[0.06] font-medium'
                  : 'text-[#555] hover:text-[#999] hover:bg-white/[0.02]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-3 border-t border-[#111] space-y-0.5">
          <a href="https://github.com/Teckdegen/Kardsagentic" target="_blank" rel="noreferrer"
            className="block px-3 py-1.5 rounded-md text-[11px] text-[#444] hover:text-white transition-colors">
            GitHub
          </a>
          <a href="#/pitch"
            className="block px-3 py-1.5 rounded-md text-[11px] text-[#444] hover:text-white transition-colors">
            Pitch Deck
          </a>
          <a href="#/"
            className="block px-3 py-1.5 rounded-md text-[11px] text-[#444] hover:text-white transition-colors">
            Home
          </a>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-[#111] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Kard" className="w-4 h-4 object-contain opacity-80" />
          <span className="text-[12px] font-semibold text-white">Kard Docs</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-[11px] text-[#555] hover:text-white transition-colors font-mono">
          {mobileOpen ? 'CLOSE' : 'MENU'}
        </button>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="lg:hidden fixed top-[49px] left-0 right-0 bottom-0 z-40 bg-black/98 backdrop-blur overflow-y-auto p-4">
          {NAV.map(item => (
            <a
              key={item.id}
              href={`#/docs`}
              onClick={(e) => {
                e.preventDefault()
                setActive(item.id)
                setMobileOpen(false)
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className={`block px-3 py-2 rounded-md text-[13px] ${
                active === item.id ? 'text-white font-medium' : 'text-[#555]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-[240px] pt-14 lg:pt-0">
        <Docs />
      </main>
    </div>
  )
}
