import Docs from '../components/Docs'
import { ArrowLeft } from 'lucide-react'

export default function DocsPage () {
  return (
    <>
      {/* Minimal nav */}
      <nav className="max-w-[1200px] mx-auto px-6 md:px-12 pt-8 flex items-center justify-between">
        <a
          href="#/"
          className="flex items-center gap-2 text-[13px] text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back to home
        </a>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0f1d32] border border-white/[0.08] flex items-center justify-center">
            <img src="/logo.png" alt="Kard" className="w-4 h-4 object-contain" />
          </div>
          <span className="text-[14px] font-semibold text-white">Kard Docs</span>
        </div>
      </nav>
      <Docs />
    </>
  )
}
