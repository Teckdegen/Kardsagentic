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
    <div className="min-h-screen w-full bg-black">
      {page === 'docs' ? <DocsPage /> : <Home />}
    </div>
  )
}

function getPage () {
  const hash = window.location.hash.replace('#', '')
  if (hash === '/docs' || hash === 'docs') return 'docs'
  return 'home'
}
