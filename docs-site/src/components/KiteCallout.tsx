import { motion } from 'motion/react'
import { Fingerprint, FileCheck, Wallet, ArrowRightLeft } from 'lucide-react'

const PILLARS = [
  { icon: Fingerprint, title: 'Identity', body: 'Kite Passport = verified agent identity. Passkey-approved spending sessions.', color: 'from-blue-500 to-indigo-600' },
  { icon: Wallet, title: 'Payment', body: 'USDC on Kite as settlement. x402 streams for machine-to-machine.', color: 'from-emerald-500 to-teal-600' },
  { icon: ArrowRightLeft, title: 'Governance', body: 'Per-session budget + time limit. Hard policy: ban chains, venues, actions.', color: 'from-amber-500 to-orange-600' },
  { icon: FileCheck, title: 'Verification', body: 'Every action → attestation tx on Kite. Anyone can decode and verify.', color: 'from-purple-500 to-pink-600' },
]

export default function KiteCallout () {
  return (
    <section id="kite" className="max-w-[1200px] mx-auto mt-32 px-5 md:px-10 scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="rounded-[28px] glass-strong p-8 md:p-14 relative overflow-hidden"
      >
        {/* Background accent */}
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-blue-500/[0.05] blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-purple-500/[0.04] blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-[12px] font-medium text-blue-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Native Kite AI integration
            </div>
            <h2 className="text-[36px] md:text-[48px] font-extrabold tracking-[-0.03em] leading-[1.0] text-white">
              Built on the AI<br />payment blockchain
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-slate-400 max-w-lg mx-auto">
              Kite AI is purpose-built for autonomous agents. Kard plugs into all four layers —
              so the agent never operates outside rules you can audit on-chain.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PILLARS.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-2xl glass p-5 hover:bg-white/[0.04] transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <p.icon size={18} strokeWidth={2} className="text-white" />
                </div>
                <h4 className="mt-4 text-[15px] font-bold text-white">{p.title}</h4>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{p.body}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://docs.gokite.ai/kite-agent-passport/beginner-setup"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-xl bg-white text-[#030712] text-[13px] font-bold hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all"
            >
              Install Kite Passport
            </a>
            <a
              href="#/docs"
              className="px-6 py-3 rounded-xl glass text-[13px] font-semibold text-slate-200 hover:bg-white/[0.06] transition-all"
            >
              Install Kard →
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
