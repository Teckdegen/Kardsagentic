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
    <div className="min-h-screen w-full relative">
      {/* Animated mesh gradient background */}
      <div className="mesh-gradient">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
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
