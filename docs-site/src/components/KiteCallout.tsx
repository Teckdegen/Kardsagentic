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
        className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-blue-500/[0.04] via-transparent to-purple-500/[0.04] p-8 md:p-14 overflow-hidden relative"
      >
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-semibold text-blue-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Built on Kite AI
            </div>
            <h2 className="text-[32px] md:text-[44px] font-semibold tracking-tight leading-[1.05] text-white">
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
                className="inline-flex items-center gap-2 bg-white text-[#050505] px-5 py-2.5 rounded-full text-[13px] font-semibold hover:bg-slate-100 transition-colors"
              >
                Install Kite Passport
              </a>
              <a
                href="#install"
                className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-slate-300 px-5 py-2.5 rounded-full text-[13px] font-semibold hover:bg-white/10 hover:text-white transition-all"
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
              body="Kite Passport gives the agent a verified identity. You approve spending sessions with a passkey — no shared secrets."
            />
            <Pillar
              icon={Wallet}
              title="Payment"
              body="USDC on Kite as the settlement asset. Pay services via x402 streams. Bridge out to wherever the trade lives."
            />
            <Pillar
              icon={ArrowRightLeft}
              title="Governance"
              body="Per-session budget, time limit, and scope. Override at any time. Hard policy: ban chains, venues, or actions."
            />
            <Pillar
              icon={FileCheck}
              title="Verification"
              body="Every action emits an attestation tx on Kite AI. Anyone can decode the calldata and verify what the agent did."
            />
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function Pillar ({ icon: Icon, title, body }: any) {
  return (
    <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all">
      <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-3">
        <Icon size={16} strokeWidth={1.5} className="text-slate-300" />
      </div>
      <h4 className="text-[14px] font-semibold text-white">{title}</h4>
      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{body}</p>
    </div>
  )
}
