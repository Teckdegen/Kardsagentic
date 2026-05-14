// Kard — Multi-chain Configuration
// Pre-configured chain settings for supported networks

export const CHAINS = {
  // ─── Testnets ───
  sepolia: {
    name: 'Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://sepolia.drpc.org',
    explorer: 'https://sepolia.etherscan.io',
    type: 'testnet',
    tokens: {
      USDT: { address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', decimals: 6 },
      DAI: { address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357', decimals: 18 },
      USDC: { address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', decimals: 6 },
      WETH: { address: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c', decimals: 18 }
    },
    aave: {
      pool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
      faucet: '0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D'
    },
    swap: 'uniswap', // Velora not available on testnets
    x402: null // USDT0 not deployed on testnets
  },

  arbitrumSepolia: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    type: 'testnet',
    tokens: {
      USDC: { address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', decimals: 6 },
      WETH: { address: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73', decimals: 18 }
    },
    aave: {
      pool: '0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff',
      dataProvider: '0x3e9708d80f7B3e43118013075F7e95CE3AB31F31'
    },
    swap: 'uniswap',
    x402: null
  },

  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    type: 'testnet',
    tokens: {
      USDT: { address: '0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a', decimals: 6 },
      USDC: { address: '0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f', decimals: 6 },
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 }
    },
    aave: {
      pool: '0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27',
      dataProvider: '0xBc9f5b7E248451CdD7cA54e717a2BFe1F32b566b',
      faucet: '0xD9145b5F45Ad4519c7ACcD6E0A4A82e83bB8A6Dc',
      aTokens: {
        USDT: '0xcE3CAae5Ed17A7AafCEEbc897DE843fA6CC0c018',
        USDC: '0x10F1A9D11CDf50041f3f8cB7191CBE2f31750ACC',
        WETH: '0x73a5bB60b0B0fc35710DDc0ea9c407031E31Bdbb'
      }
    },
    swap: 'uniswap',
    uniswap: {
      SWAP_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
      QUOTER_V2: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27',
      FACTORY: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'
    },
    x402: null
  },

  // ─── Mainnets ───
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    type: 'mainnet',
    tokens: {
      USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      'USDC.e': { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6 },
      WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
      DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
      USDT0: { address: '0x3b3a2A1e12CE692F7e395b3e8b92e1FC9E5e3e0A', decimals: 6 }
    },
    aave: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    swap: 'velora',
    x402: {
      network: 'eip155:42161',
      tokenAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
    }
  },

  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://eth.drpc.org',
    explorer: 'https://etherscan.io',
    type: 'mainnet',
    tokens: {
      USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
      DAI: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
      USDT0: { address: '0x3b3a2A1e12CE692F7e395b3e8b92e1FC9E5e3e0A', decimals: 6 }
    },
    aave: {
      pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
    },
    swap: 'velora',
    x402: {
      network: 'eip155:1',
      tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    }
  },

  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    type: 'mainnet',
    tokens: {
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
      DAI: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 }
    },
    aave: {
      pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'
    },
    swap: 'velora',
    x402: null
  },

  // ─── Kite AI (settlement + attestation chain) ───
  kiteai: {
    name: 'Kite AI',
    chainId: 2366,
    rpcUrl: 'https://rpc.gokite.ai',
    explorer: 'https://kitescan.ai',
    type: 'mainnet',
    tokens: {
      // Lucid L-USDC (yield-bearing canonical USDC on KiteAI, 90% deposited to Aave on Arbitrum)
      USDC: { address: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e', decimals: 6, lucid: true },
      WETH: { address: '0x3D66d6c3201190952e8EA973F59c4428b32D5F9b', decimals: 18, lucid: true },
      USDT: { address: '0x3Fdd283C4c43A60398bf93CA01a8a8BD773a755b', decimals: 6, lucid: true }
    },
    // Lucid Kite controllers — lock contracts on KiteAI that mint/burn L-* via LayerZero adapters
    lucid: {
      USDC: {
        controller: '0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b',
        lockChain: 'arbitrum', // collateral custody chain (90% to Aave v3)
        deployedChains: ['avalanche', 'kiteai'],
        bridgeAdapters: ['LayerZero'],
        avalancheToken: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e'
      },
      WETH: {
        controller: '0x638d1c70c7b047b192eB88657B411F84fAc74681',
        lockChain: 'arbitrum',
        deployedChains: ['avalanche', 'kiteai'],
        bridgeAdapters: ['LayerZero'],
        avalancheToken: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB'
      },
      USDT: {
        controller: '0x80bA7204f060Fd321BFE8d4F3aB2E2bF4e6fCe49',
        lockChain: 'arbitrum',
        deployedChains: ['celo', 'kiteai'],
        bridgeAdapters: ['LayerZero']
      }
    },
    // Native attestation layer — every agent action writes a verifiable record here
    attestations: {
      enabled: true
    },
    swap: null,    // No native DEX yet — agent uses bridge-out for execution
    x402: null
  },

  // ─── Avalanche (Lucid lock-chain origin for L-USDC / L-WETH) ───
  avalanche: {
    name: 'Avalanche C-Chain',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorer: 'https://snowtrace.io',
    type: 'mainnet',
    tokens: {
      USDC: { address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', decimals: 6, lucid: true },
      WETH: { address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', decimals: 18, lucid: true }
    },
    aave: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    swap: 'velora',
    x402: null
  },

  // ─── Celo (Lucid lock-chain origin for L-USDT) ───
  celo: {
    name: 'Celo',
    chainId: 42220,
    rpcUrl: 'https://forno.celo.org',
    explorer: 'https://celoscan.io',
    type: 'mainnet',
    tokens: {
      // Lucid USDT lock-chain origin — controller-managed
      USDT: { lucid: true, decimals: 6 }
    },
    swap: null,
    x402: null
  }
}

/**
 * Resolve chain config from env vars or chain name
 * @param {string} [chainName] - Chain name override (default: auto-detect from ETH_RPC_URL)
 * @returns {object} Chain configuration
 */
export function resolveChainConfig (chainName) {
  // Explicit chain name
  if (chainName && CHAINS[chainName]) {
    return { ...CHAINS[chainName] }
  }

  // Default to sepolia (testnet) for safety
  return { ...CHAINS.sepolia }
}

/**
 * Get chain config by chain ID
 * @param {number} chainId
 * @returns {object|null} Chain configuration
 */
export function getChainById (chainId) {
  for (const config of Object.values(CHAINS)) {
    if (config.chainId === chainId) return { ...config }
  }
  return null
}
