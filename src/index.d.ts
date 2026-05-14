// @kard/agent — TypeScript definitions for the public SDK
//
// Hand-written types for the surface that consumers actually call. The
// implementation stays JS/JSDoc so we don't take a TS-build dependency,
// but `import { compileStrategy } from '@kard/agent'` autocompletes.

export type LlmProviderName =
  | 'anthropic' | 'claude'
  | 'openai' | 'gpt'
  | 'openrouter'
  | 'deepseek'
  | 'ollama' | 'local'

export interface LlmCallOpts {
  provider?: LlmProviderName
  model?: string
  apiKey?: string
  baseUrl?: string
}

export interface ActionBase {
  type: string
  reason?: string
  priority?: 'critical' | 'high' | 'medium' | 'low'
  confidence?: number
}

export interface PerpsOpenAction extends ActionBase {
  type: 'perps_open'
  symbol: string
  side: 'long' | 'short'
  size: number
  leverage?: number
  limitPx?: number
  reduceOnly?: boolean
  isolated?: boolean
}
export interface PerpsCloseAction extends ActionBase {
  type: 'perps_close'
  symbol: string
  size?: number
}
export interface SwapAction extends ActionBase {
  type: 'swap'
  tokenIn: string
  tokenOut: string
  amount: number
}
export interface LendingAction extends ActionBase {
  type: 'lending_supply' | 'lending_withdraw'
  token: string
  amount: number
  chain?: string
}
export interface LucidAction extends ActionBase {
  type: 'lucid_mint' | 'lucid_burn'
  asset: string
  amount: number
  sourceChain?: string
  targetChain?: string
}
export interface SkillAction extends ActionBase {
  type: 'skill'
  name: string
  tool?: string
  params?: Record<string, unknown>
  allowWrites?: boolean
}
export interface BridgeAction extends ActionBase {
  type: 'bridge'
  targetChain: string
  amount: number
}
export interface AlertAction extends ActionBase {
  type: 'alert'
  level?: 'info' | 'warning' | 'critical'
}

export type Action =
  | PerpsOpenAction | PerpsCloseAction | SwapAction
  | LendingAction | LucidAction | SkillAction
  | BridgeAction | AlertAction
  | (ActionBase & { type: string })

export interface CompiledStrategy {
  reasoning?: string
  answer?: string
  market_assessment?: 'bullish' | 'bearish' | 'neutral' | 'uncertain'
  risk_level?: 'low' | 'medium' | 'high' | 'critical'
  actions: Action[]
  rules?: any[]
  next_check_suggestion?: string
  _meta?: {
    provider?: string
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    timestamp?: string
  }
}

export function compileStrategy (
  text: string,
  opts?: LlmCallOpts
): Promise<CompiledStrategy>

export interface CreateAgentOpts extends LlmCallOpts {
  strategy?: string | StrategyConfig
  useWalletManager?: boolean
  withGoals?: boolean
}

export interface StrategyConfig {
  name: string
  targetYield?: number
  maxRisk?: number
  allocations?: Record<string, number>
  rebalanceThreshold?: number
  baseCurrency?: string
  perps?: {
    venue?: string
    network?: 'testnet' | 'mainnet'
    maxLeverage?: number
    riskPerTrade?: number
    maxConcurrentPositions?: number
    universe?: string[]
  }
  lucid?: {
    enabled: boolean
    asset?: string
    sourceChain?: string
    targetChain?: string
    minMintAmount?: number
    keepBuffer?: number
    minYieldEdgeBps?: number
  }
}
export const STRATEGIES: Record<string, StrategyConfig>

export interface AgentSnapshot {
  address?: string
  active?: boolean
  paused?: boolean
  cycle: number
  strategy: StrategyConfig | null
  balances: Record<string, number>
  supplied: Record<string, number>
  portfolio?: { totalUSD: number, byAsset: Record<string, number> }
  prices: Record<string, { usd: number, usd_24h_change?: number }>
  perps?: any
  lucid?: any
  attestations?: any
  opportunities?: any
  passport?: { enabled: boolean, address?: string, email?: string }
  reasoningTrail: any[]
  recentActions: any[]
}

export interface TreasuryAgentLike {
  init (): Promise<this>
  refresh (): Promise<void>
  setStrategy (s: string | StrategyConfig): void
  setSkills (registry: SkillRegistry): this
  evaluate (): Promise<Action[]>
  execute (action: Action, attempt?: number): Promise<any>
  cycle (): Promise<void>
  start (intervalMs?: number): void
  stop (): void
  getSnapshot (): AgentSnapshot
}
export const TreasuryAgent: { new (): TreasuryAgentLike }

export function createAgent (opts?: CreateAgentOpts): Promise<TreasuryAgentLike>
export function quickRun (text: string, opts?: CreateAgentOpts):
  Promise<{ decision: CompiledStrategy, snapshot: AgentSnapshot, proposedActions: any[] }>

// ─── Skills ───
export interface SkillTool {
  id: string
  description?: string
  endpoint?: string
  kind?: 'http' | 'js' | 'instruction'
  script?: string
  export?: string
}
export interface Skill {
  name: string
  description?: string
  triggers?: string[]
  tools?: SkillTool[]
  permissions?: { network?: string[], reads?: boolean, writes?: boolean }
  body?: string
}
export class SkillRegistry {
  loadAll (): this
  list (): Skill[]
  get (name: string): Skill | undefined
  describeForPrompt (): string
  invoke (name: string, tool: string, params?: any, ctx?: any): Promise<any>
  addFromPath (filePath: string): Skill
  remove (name: string): void
  watch (onChange?: (e: { event: string, filename: string, dir: string }) => void): void
  unwatch (): void
}
export function defaultSkills (): SkillRegistry

// ─── Goals / Fleet / Streams / Wallet / Passport / Risk / Attestor ───
export class GoalEngine {
  constructor (cfg: { agent: TreasuryAgentLike, llm: any, skills?: SkillRegistry })
  setGoal (text: string, opts?: any): Promise<any>
  start (): void
  stop (): void
  list (): any[]
  removeGoal (id: string): void
}

export class Fleet {
  constructor (cfg: any)
  spawnAll (): Promise<void>
  spawn (spec: any): Promise<TreasuryAgentLike>
  startAll (intervalMs?: number): void
  stopAll (): void
  state (): any
  on (event: string, cb: (...args: any[]) => void): this
}
export function loadFleetConfig (path: string): any

export class WalletManager {
  resolve (opts?: { interactive?: boolean, preferPassport?: boolean }):
    Promise<{ privateKey?: string, address: string, source: string, passport?: any }>
  unlock (password?: string, opts?: any): Promise<any>
  list (): { index: number, label: string, address: string, active: boolean }[]
  addAccount (opts?: { label?: string }): Promise<any>
  import (pk: string, opts?: { label?: string }): Promise<any>
  exists (): boolean
}

export class KitePassport {
  isInstalled (): boolean
  installHint (): string
  me (): Promise<any>
  signup (email: string): Promise<string>
  verify (code: string): Promise<string>
  address (): Promise<string | null>
  balance (): Promise<any>
  createSession (cfg: { budget: number, duration: string, scope?: string, maxPerTx?: number, description?: string }): Promise<any>
  listSessions (opts?: { status?: string }): Promise<any[]>
  revokeSession (id: string): Promise<string>
  pay (cfg: { sessionId: string, recipient: string, amount: number, memo?: string }): Promise<any>
  ensureSession (cfg: { budget: number, minRemaining?: number, duration?: string, scope?: string, description?: string }): Promise<any>
}

export class KiteAttestor {
  constructor (cfg: { chainContext: any, contractAddress?: string, uploader?: (env: any) => Promise<string>, enabled?: boolean })
  attest (action: Action, result: any, meta?: any): Promise<any>
  verify (txHash: string): Promise<any>
  list (opts?: { limit?: number }): any[]
}

export class RiskEngine {
  constructor (cfg?: { limits?: any, buckets?: Record<string, string[]> })
  evaluate (action: Action, state: any): { ok: boolean, reason?: string, clamped?: any }
  recordEquity (eq: number, ts?: number): void
  isKilled (): boolean
  state (currentEquity?: number): any
}
export function pullKillSwitch (): void
export function releaseKillSwitch (): void

export class PaymentStream {
  constructor (cfg: any)
  start (): void
  stop (): void
  on (event: string, cb: (data: any) => void): this
}
export class StreamManager {
  constructor (cfg?: { client?: any, context?: any, autoRestore?: boolean })
  add (spec: any): PaymentStream
  remove (id: string): void
  list (): any[]
}

// ─── Chat ───
export interface ChatAdapterLike {
  start (): Promise<void>
  stop (): Promise<void>
  send (channelId: string | number, text: string): Promise<any>
  on (event: 'message' | string, cb: (m: any) => void): this
}
export const TelegramAdapter: { new (cfg?: any): ChatAdapterLike }
export const DiscordAdapter:  { new (cfg?: any): ChatAdapterLike }
export const SlackAdapter:    { new (cfg?: any): ChatAdapterLike }
export function createChatAdapter (name: 'telegram' | 'discord' | 'slack', opts?: any): ChatAdapterLike
export function bridgeChat (cfg: { adapter: ChatAdapterLike, agent: TreasuryAgentLike, llm: any, goals?: GoalEngine, skills?: SkillRegistry, allowExecute?: boolean }): { adapter: ChatAdapterLike, stop: () => void }
