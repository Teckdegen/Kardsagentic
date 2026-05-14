import Hero from './components/Hero'
import Marquee from './components/Marquee'
import WhatIsKard from './components/WhatIsKard'
import KiteCallout from './components/KiteCallout'
import HowItWorks from './components/HowItWorks'
import Docs from './components/Docs'
import Footer from './components/Footer'

export default function App () {
  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Global ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute top-[40%] right-[10%] w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-emerald-500/3 blur-[80px]" />
      </div>

      <div className="relative z-10">
        <Hero />
        <Marquee />
        <WhatIsKard />
        <HowItWorks />
        <KiteCallout />
        <Docs />
        <Footer />
      </div>
    </div>
  )
}
