import { motion } from 'motion/react'
import { Fingerprint, FileCheck, Wallet, ArrowRightLeft } from 'lucide-react'

export default function KiteCallout () {
  return (
    <section id="kite" className="max-w-[1200px] mx-auto mt-32 px-6 md:px-12 scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="rounded-3xl border border-white/[0.06] bg-[#0c1a2e] p-8 md:p-14 overflow-hidden relative"
      >
        {/* Subtle glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-500/[0.04] blur-[100px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/[0.08] border border-blue-500/[0.15] text-[11px] font-semibold text-blue-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Built on Kite AI
            </div>
            <h2 className="text-[32px] md:text-[44px] font-bold tracking-tight leading-[1.05] text-white">
              The AI payment<br />blockchain
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-slate-400 max-w-lg">
              Kite AI is purpose-built infrastructure for autonomous agents —
              identity, payment, governance, and verification in one chain.
              Kard plugs into all four layers so the agent never operates
              outside rules you can audit on-chain.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="https://docs.gokite.ai/kite-agent-passport/beginner-setup"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-white text-[#0a1628] px-5 py-2.5 rounded-full text-[13px] font-semibold hover:bg-slate-100 transition-colors"
              >
                Install Kite Passport
              </a>
              <a
                href="#/docs"
                className="inline-flex items-center gap-2 bg-[#152540] border border-white/[0.08] text-slate-300 px-5 py-2.5 rounded-full text-[13px] font-semibold hover:border-white/[0.15] hover:text-white transition-all"
              >
                Install Kard
              </a>
            </div>
          </div>

          {/* Right — four pillars */}
          <div className="grid grid-cols-2 gap-3">
            <Pillar
              icon={Fingerprint}
              title="Identity"
              body="Kite Passport gives the agent a verified identity. Passkey-approved spending sessions."
            />
            <Pillar
              icon={Wallet}
              title="Payment"
              body="USDC on Kite as settlement. x402 streams for machine-to-machine payments."
            />
            <Pillar
              icon={ArrowRightLeft}
              title="Governance"
              body="Per-session budget, time limit, scope. Hard policy: ban chains, venues, or actions."
            />
            <Pillar
              icon={FileCheck}
              title="Verification"
              body="Every action emits an attestation tx on Kite AI. Anyone can decode and verify."
            />
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function Pillar ({ icon: Icon, title, body }: any) {
  return (
    <div className="rounded-xl p-5 bg-[#0a1628] border border-white/[0.06] hover:border-blue-500/20 transition-all">
      <div className="w-9 h-9 rounded-lg bg-[#152540] border border-white/[0.06] flex items-center justify-center mb-3">
        <Icon size={16} strokeWidth={1.5} className="text-blue-400" />
      </div>
      <h4 className="text-[14px] font-semibold text-white">{title}</h4>
      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{body}</p>
    </div>
  )
}
