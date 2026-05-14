import { ArrowLeft } from 'lucide-react'
import Docs from '../components/Docs'

export default function DocsPage () {
  return (
    <>
      <nav className="max-w-[1200px] mx-auto px-5 md:px-10 pt-6 flex items-center justify-between">
        <a
          href="#/"
          className="flex items-center gap-2 text-[13px] text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Home
        </a>
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Kard" className="w-6 h-6 object-contain" />
          <span className="text-[14px] font-bold text-white">Kard Docs</span>
        </div>
      </nav>
      <Docs />
    </>
  )
}
