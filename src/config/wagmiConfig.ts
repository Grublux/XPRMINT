import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Minimal wagmi config for XPRMINT.
// Only uses the generic injected connector (MetaMask, browser wallets).
// No Base/Coinbase/Gemini/Safe/WalletConnect SDKs, so we avoid all the missing-module hell.

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
  },
  ssr: true,
});
