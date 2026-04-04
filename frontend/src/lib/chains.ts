/** CAIP-2 chain registry aligned with OWS spec (07 — Supported Chains) */

export interface ChainInfo {
  name: string;
  symbol: string;
  family: string;
}

export const CHAINS: Record<string, ChainInfo> = {
  // EVM
  "eip155:1": { name: "Ethereum", symbol: "ETH", family: "EVM" },
  "eip155:137": { name: "Polygon", symbol: "MATIC", family: "EVM" },
  "eip155:8453": { name: "Base", symbol: "ETH", family: "EVM" },
  "eip155:42161": { name: "Arbitrum", symbol: "ETH", family: "EVM" },
  "eip155:10": { name: "Optimism", symbol: "ETH", family: "EVM" },
  "eip155:56": { name: "BNB Chain", symbol: "BNB", family: "EVM" },
  "eip155:43114": { name: "Avalanche", symbol: "AVAX", family: "EVM" },
  "eip155:9745": { name: "Plasma", symbol: "ETH", family: "EVM" },
  "eip155:42793": { name: "Etherlink", symbol: "ETH", family: "EVM" },
  // Non-EVM
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": { name: "Solana", symbol: "SOL", family: "Solana" },
  "bip122:000000000019d6689c085ae165831e93": { name: "Bitcoin", symbol: "BTC", family: "Bitcoin" },
  "cosmos:cosmoshub-4": { name: "Cosmos", symbol: "ATOM", family: "Cosmos" },
  "tron:mainnet": { name: "Tron", symbol: "TRX", family: "Tron" },
  "ton:mainnet": { name: "TON", symbol: "TON", family: "TON" },
  "sui:mainnet": { name: "Sui", symbol: "SUI", family: "Sui" },
  "xrpl:mainnet": { name: "XRPL", symbol: "XRP", family: "XRPL" },
  "spark:mainnet": { name: "Spark", symbol: "BTC", family: "Spark" },
  "fil:mainnet": { name: "Filecoin", symbol: "FIL", family: "Filecoin" },
};

/** Pretty-print a CAIP-2 chain ID → human name, e.g. "Arbitrum" */
export function chainName(chainId: string): string {
  return CHAINS[chainId]?.name ?? chainId;
}

/** Pretty-print with family badge, e.g. "Arbitrum (EVM)" */
export function chainLabel(chainId: string): string {
  const info = CHAINS[chainId];
  if (!info) return chainId;
  return `${info.name} (${info.family})`;
}

/** Short label for dropdowns: "Arbitrum (eip155:42161)" */
export function chainOption(chainId: string): string {
  const info = CHAINS[chainId];
  if (!info) return chainId;
  return `${info.name} (${chainId})`;
}

/** Get native symbol for a chain */
export function chainSymbol(chainId: string): string {
  return CHAINS[chainId]?.symbol ?? "???";
}

/** All known CAIP-2 chain IDs */
export const ALL_CHAIN_IDS = Object.keys(CHAINS);
