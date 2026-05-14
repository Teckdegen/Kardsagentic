import { useState, useEffect } from 'react'
import Home from './pages/Home'
import DocsPage from './pages/DocsPage'

export default function App () {
  const [page, setPage] = useState(getPage())

  useEffect(() => {
    const onHash = () => setPage(getPage())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Global ambient glows — navy tinted */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[15%] w-[700px] h-[700px] rounded-full bg-blue-600/[0.04] blur-[140px]" />
        <div className="absolute top-[50%] right-[5%] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10">
        {page === 'docs' ? <DocsPage /> : <Home />}
      </div>
    </div>
  )
}

function getPage () {
  const hash = window.location.hash.replace('#', '')
  if (hash === '/docs' || hash === 'docs') return 'docs'
  return 'home'
}
