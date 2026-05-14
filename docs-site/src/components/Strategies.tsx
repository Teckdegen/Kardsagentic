import { motion } from 'motion/react'

export default function Strategies () {
  return (
    <section className="max-w-[1200px] mx-auto px-6 pt-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h2 className="text-[40px] md:text-[60px] font-black tracking-[-0.04em] leading-[0.95]">
          <span className="text-white">The </span>
          <span className="text-white italic">fastest</span>
          <span className="text-white"><br />way to trade.</span>
        </h2>
        <p className="mt-6 text-[14px] text-[#71717a] max-w-[500px] mx-auto">
          We track every yield source, funding rate, and signal in real time — and act before anyone else can
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="terminal max-w-[700px] mx-auto"
      >
        <div className="terminal-header">
          <div className="terminal-dot bg-[#ff5f57]" />
          <div className="terminal-dot bg-[#febc2e]" />
          <div className="terminal-dot bg-[#28c840]" />
          <span className="ml-3 text-[11px] text-[#52525b] font-mono">kard strategy list</span>
        </div>
        <div className="terminal-body text-[13px]">
          <div className="text-[#52525b] mb-3">Available strategies:</div>
          {[
            ['CONSERVATIVE', '~3%', 'Low'],
            ['KITE_YIELD', '~7%', 'Low'],
            ['USDT_YIELD', '~8%', 'Med'],
            ['BALANCED', '~6%', 'Med'],
            ['DELTA_NEUTRAL', '~12%', 'Med'],
            ['LP_FARMER', '~15%', 'Med'],
            ['FULL_STACK', '~18%', 'Med'],
            ['PERPS_TRADER', '~20%', 'High'],
          ].map(([name, apy, risk]) => (
            <div key={name} className="flex items-center gap-4 py-1">
              <span className="text-white font-medium w-[140px]">{name}</span>
              <span className="text-white w-[50px]">{apy}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded ${
                risk === 'Low' ? 'text-emerald-400 bg-emerald-400/10' :
                risk === 'Med' ? 'text-amber-400 bg-amber-400/10' :
                'text-red-400 bg-red-400/10'
              }`}>{risk}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
