import { useState } from 'react'
import Docs from '../components/Docs'

const NAV = [
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'install', label: 'Installation' },
  { id: 'wallet', label: 'Wallet Setup' },
  { id: 'llm', label: 'LLM Configuration' },
  { id: 'funding', label: 'Funding (Testnet)' },
  { id: 'first-run', label: 'First Run' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'policy', label: 'Safety & Policy' },
  { id: 'yields', label: 'Yield Opportunities' },
  { id: 'attestations', label: 'Attestations' },
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

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — GitBook style */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-[#1a1a1a] bg-[#0a0a0a] fixed top-0 left-0 h-screen overflow-y-auto">
        <div className="p-5 border-b border-[#1a1a1a]">
          <a href="#/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Kard" className="w-5 h-5 object-contain" />
            <span className="text-[14px] font-bold text-white">Kard Docs</span>
          </a>
        </div>
        <nav className="p-4 space-y-0.5 flex-1">
          {NAV.map(item => (
            <a
              key={item.id}
              href={`#/docs`}
              onClick={(e) => {
                e.preventDefault()
                setActive(item.id)
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className={`block px-3 py-2 rounded-lg text-[13px] transition-colors ${
                active === item.id
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-[#71717a] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-[#1a1a1a]">
          <a
            href="https://github.com/Teckdegen/Kardsagentic"
            target="_blank"
            rel="noreferrer"
            className="block px-3 py-2 rounded-lg text-[12px] text-[#52525b] hover:text-white transition-colors"
          >
            GitHub ↗
          </a>
          <a
            href="#/"
            className="block px-3 py-2 rounded-lg text-[12px] text-[#52525b] hover:text-white transition-colors"
          >
            ← Back to home
          </a>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
        <a href="#/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Kard" className="w-5 h-5 object-contain" />
          <span className="text-[13px] font-bold text-white">Kard Docs</span>
        </a>
        <a href="#/" className="text-[12px] text-[#71717a]">← Home</a>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-[260px] pt-16 lg:pt-0">
        <Docs />
      </main>
    </div>
  )
}
