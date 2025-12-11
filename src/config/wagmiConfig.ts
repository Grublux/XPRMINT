import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { apechain } from "./chains/apechain";

// Minimal wagmi config for XPRMINT.
// Only uses the generic injected connector (MetaMask, browser wallets).
// No Base/Coinbase/Gemini/Safe/WalletConnect SDKs, so we avoid all the missing-module hell.

// Use RPC URL from env if available, otherwise use chain default
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || apechain.rpcUrls.default.http[0];

export const wagmiConfig = createConfig({
  chains: [apechain],
  connectors: [injected()],
  transports: {
    [apechain.id]: http(rpcUrl),
  },
  ssr: true,
});
