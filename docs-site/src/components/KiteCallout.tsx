import { motion } from 'motion/react'

export default function KiteCallout () {
  return (
    <section id="kite" className="max-w-[1200px] mx-auto px-6 pt-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <h2 className="text-[40px] md:text-[60px] font-black tracking-[-0.04em] leading-[0.95]">
          <span className="text-white">Settled on </span>
          <span className="text-[#2563eb]">Kite AI</span>
          <span className="text-white">.</span>
        </h2>
        <p className="mt-6 text-[16px] text-[#71717a] max-w-[500px] mx-auto leading-relaxed">
          Every action your agent takes is cryptographically attested on Kite AI.
          Verifiable. Permanent. Auditable by anyone.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[800px] mx-auto">
        <Card title="Identity" desc="Kite Passport gives the agent a verified identity. Passkey-approved spending sessions." />
        <Card title="Payment" desc="USDC on Kite as settlement. x402 micropayments for machine-to-machine API access." />
        <Card title="Governance" desc="Per-session budget, time limit, scope. Hard policy enforcement at three layers." />
        <Card title="Verification" desc="Every action → attestation tx on Kite AI. Decode calldata = full action JSON." />
      </div>

      {/* Big closing statement */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="text-center mt-32"
      >
        <h2 className="text-[36px] md:text-[52px] font-black tracking-[-0.03em] leading-[1.0]">
          <span className="text-[#71717a]">Anything you'd do yourself,<br />you can do better on </span>
          <span className="text-[#2563eb]">Kard</span>
          <span className="text-[#71717a]">.</span>
        </h2>
      </motion.div>
    </section>
  )
}

function Card ({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-6 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] hover:border-[#2563eb]/30 transition-colors">
      <h4 className="text-[16px] font-bold text-white mb-2">{title}</h4>
      <p className="text-[13px] leading-relaxed text-[#71717a]">{desc}</p>
    </div>
  )
}
