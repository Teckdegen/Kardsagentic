// @kard/agent — Tax / Audit Export
//
// Reads the bookkeeper's ledger and produces tax-software-compatible exports.
//
// Supported formats:
//   - 8949    : US IRS Form 8949 CSV (short-term + long-term sections)
//   - koinly  : Koinly generic CSV
//   - cointracker : CoinTracker CSV
//   - generic : flat CSV (date, asset, qty, cost_basis, proceeds, gain, type)
//   - json    : full structured JSON for custom pipelines
//
// Cost-basis methods: FIFO (default), LIFO, HIFO.
//
// Each row is annotated with the on-chain attestation tx hash so a
// regulator can verify the transaction actually happened on KiteAI.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const LEDGER_FILE = path.join(os.homedir(), '.kard', 'ledger.ndjson')

const FORMATS = ['8949', 'koinly', 'cointracker', 'generic', 'json']
const METHODS = ['fifo', 'lifo', 'hifo']

export class TaxExporter {
  constructor (cfg = {}) {
    this.ledgerPath = cfg.ledgerPath || LEDGER_FILE
    this.method = (cfg.method || 'fifo').toLowerCase()
    if (!METHODS.includes(this.method)) throw new Error(`Unknown method: ${this.method}`)
  }

  /** Returns array of realized-gain rows */
  computeRows ({ year } = {}) {
    if (!fs.existsSync(this.ledgerPath)) return []
    const entries = fs.readFileSync(this.ledgerPath, 'utf8').trim().split('\n')
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)

    // Build per-asset lot books
    const lots = new Map()  // asset → [{ qty, cost, ts, attestation }]
    const rows = []

    const pickLots = (asset, qty) => {
      const book = lots.get(asset) || []
      if (this.method === 'fifo')      book.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
      else if (this.method === 'lifo') book.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
      else if (this.method === 'hifo') book.sort((a, b) => (b.cost / b.qty) - (a.cost / a.qty))
      const taken = []
      let remaining = qty
      while (remaining > 0 && book.length) {
        const lot = book[0]
        const t = Math.min(remaining, lot.qty)
        const cost = (lot.cost / lot.qty) * t
        taken.push({ qty: t, cost, openedTs: lot.ts, attestation: lot.attestation })
        lot.qty -= t; lot.cost -= cost
        remaining -= t
        if (lot.qty <= 1e-9) book.shift()
      }
      lots.set(asset, book)
      return taken
    }

    for (const e of entries) {
      // Filter by year if requested
      if (year && new Date(e.ts).getUTCFullYear() !== year) continue

      switch (e.kind) {
        case 'perp_open':
        case 'yield_open':
        case 'swap': {
          // Acquire — adds to lots (use cost-basis = USD value at time)
          const asset = e.symbol || e.asset || e.tokenOut
          if (!asset) continue
          const qty = e.size || e.amount || 0
          const cost = e.basisUSD || (qty * (e.entryPx || e.openPx || 0))
          if (qty > 0) {
            const book = lots.get(asset) || []
            book.push({ qty, cost, ts: e.ts, attestation: e.tx })
            lots.set(asset, book)
          }
          break
        }
        case 'perp_close':
        case 'yield_close': {
          const asset = e.symbol || e.asset
          const qty = e.size || e.amount || 0
          const proceeds = e.kind === 'perp_close'
            ? (e.closePx * qty) + (e.pnl || 0)  // approximate proceeds
            : (qty + (e.earned || 0)) * (e.exitPx || 1)
          if (qty <= 0) continue
          const taken = pickLots(asset, qty)
          for (const t of taken) {
            const open = Date.parse(t.openedTs)
            const close = Date.parse(e.ts)
            const heldDays = (close - open) / 86400_000
            const longTerm = heldDays >= 365
            const proceedsForLot = proceeds * (t.qty / qty)
            const gain = proceedsForLot - t.cost
            rows.push({
              date_acquired: t.openedTs.slice(0, 10),
              date_sold: e.ts.slice(0, 10),
              asset,
              quantity: t.qty,
              cost_basis: t.cost,
              proceeds: proceedsForLot,
              gain,
              type: longTerm ? 'long-term' : 'short-term',
              source: e.kind,
              attestation_open: t.attestation,
              attestation_close: e.tx
            })
          }
          break
        }
        case 'expense':
          // x402 payments out — fee deduction (treated as ordinary loss)
          rows.push({
            date_sold: e.ts.slice(0, 10),
            asset: 'USD', quantity: e.amount || 0,
            cost_basis: e.amount || 0, proceeds: 0,
            gain: -(e.amount || 0),
            type: 'expense', source: 'x402', attestation_close: e.tx
          })
          break
        case 'revenue':
          // x402 received — ordinary income
          rows.push({
            date_acquired: e.ts.slice(0, 10),
            asset: 'USD', quantity: e.amount || 0,
            cost_basis: 0, proceeds: e.amount || 0,
            gain: e.amount || 0,
            type: 'income', source: 'x402', attestation_open: e.tx
          })
          break
      }
    }

    return rows
  }

  export ({ year, format = '8949' } = {}) {
    if (!FORMATS.includes(format)) throw new Error(`Unknown format: ${format}. Have: ${FORMATS.join(', ')}`)
    const rows = this.computeRows({ year })

    if (format === 'json') return JSON.stringify({ method: this.method, year, rows }, null, 2)

    if (format === '8949') return this._format8949(rows)
    if (format === 'koinly') return this._formatKoinly(rows)
    if (format === 'cointracker') return this._formatCointracker(rows)
    return this._formatGeneric(rows)
  }

  /** Summary stats for `kard taxes summary` */
  summary ({ year } = {}) {
    const rows = this.computeRows({ year })
    const out = {
      method: this.method, year,
      tradeCount: rows.length,
      shortTermGain: 0, shortTermLoss: 0,
      longTermGain: 0, longTermLoss: 0,
      ordinaryIncome: 0, expenses: 0
    }
    for (const r of rows) {
      if (r.type === 'income') out.ordinaryIncome += r.gain
      else if (r.type === 'expense') out.expenses += -r.gain
      else if (r.type === 'short-term') {
        if (r.gain >= 0) out.shortTermGain += r.gain
        else out.shortTermLoss += -r.gain
      } else if (r.type === 'long-term') {
        if (r.gain >= 0) out.longTermGain += r.gain
        else out.longTermLoss += -r.gain
      }
    }
    out.netShortTerm = out.shortTermGain - out.shortTermLoss
    out.netLongTerm  = out.longTermGain  - out.longTermLoss
    out.taxableTotal = out.netShortTerm + out.netLongTerm + out.ordinaryIncome - out.expenses
    return out
  }

  // ─── Formatters ───

  _format8949 (rows) {
    const header = 'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Gain/Loss,Term'
    const out = [header]
    for (const r of rows) {
      if (r.type === 'income' || r.type === 'expense') continue
      out.push([
        `${r.quantity?.toFixed(8) || 0} ${r.asset}`,
        r.date_acquired || '',
        r.date_sold || '',
        r.proceeds?.toFixed(2) || 0,
        r.cost_basis?.toFixed(2) || 0,
        r.gain?.toFixed(2) || 0,
        r.type === 'long-term' ? 'Long' : 'Short'
      ].join(','))
    }
    return out.join('\n')
  }

  _formatKoinly (rows) {
    const header = 'Date,Sent Amount,Sent Currency,Received Amount,Received Currency,Fee Amount,Fee Currency,Net Worth Amount,Net Worth Currency,Label,Description,TxHash'
    const out = [header]
    for (const r of rows) {
      out.push([
        r.date_sold || r.date_acquired || '',
        r.cost_basis?.toFixed(2) || '',  r.asset,
        r.proceeds?.toFixed(2) || '',    'USD',
        '', '', '', 'USD',
        r.type, r.source || '',
        r.attestation_close || r.attestation_open || ''
      ].join(','))
    }
    return out.join('\n')
  }

  _formatCointracker (rows) {
    const header = 'Date,Received Quantity,Received Currency,Sent Quantity,Sent Currency,Fee Amount,Fee Currency,Tag'
    const out = [header]
    for (const r of rows) {
      out.push([
        r.date_sold || r.date_acquired || '',
        r.proceeds ? r.proceeds.toFixed(2) : '',  'USD',
        r.cost_basis ? r.cost_basis.toFixed(2) : '', r.asset,
        '', '', r.type
      ].join(','))
    }
    return out.join('\n')
  }

  _formatGeneric (rows) {
    const header = 'date_acquired,date_sold,asset,quantity,cost_basis,proceeds,gain,type,source,attestation_open,attestation_close'
    const out = [header]
    for (const r of rows) {
      out.push([
        r.date_acquired || '', r.date_sold || '',
        r.asset, r.quantity || 0,
        (r.cost_basis || 0).toFixed(2), (r.proceeds || 0).toFixed(2),
        (r.gain || 0).toFixed(2), r.type, r.source || '',
        r.attestation_open || '', r.attestation_close || ''
      ].join(','))
    }
    return out.join('\n')
  }
}

export { FORMATS, METHODS }
