#!/usr/bin/env node
// @kard/agent — MCP server (stdio)
//
// Exposes the kard.* tool surface so any MCP host (Claude Code, Cursor,
// Claude Desktop) can drive the entire stack.
//
// Tools registered (see src/mcp-tools.js):
//   kard.compile             text → action plan
//   kard.opportunities       live ranked yield
//   kard.attest_verify       decode an on-chain attestation
//   kard.passport.address    get Passport wallet
//   kard.passport.pay        pay a recipient via Passport session
//   kard.skill.list / .run / .search / .install
//   kard.goal.set            set autonomous goal
//   kard.fleet_state         multi-agent state snapshot
//
// Run:  npx @kard/agent mcp
// Configure in your MCP host:
//   { "mcpServers": { "kard": { "command": "npx", "args": ["-y", "@kard/agent", "mcp"] } } }

import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerKardTools } from './mcp-tools.js'

const server = new McpServer({
  name: '@kard/agent',
  version: '0.1.0'
})

registerKardTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)

console.error('[kard-mcp] running on stdio')
