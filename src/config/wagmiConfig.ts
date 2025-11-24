import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { apechain } from './chains/apechain';

export const wagmiConfig = createConfig({
  chains: [apechain],
  connectors: [
    injected({
      // Disable auto-connect - only connect when user clicks button
      shimDisconnect: false,
    }),
  ],
  transports: {
    [apechain.id]: http('https://apechain.calderachain.xyz/http'),
  },
  ssr: false, // Disable SSR
});

