import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { apechain } from './chains/apechain';

export const wagmiConfig = createConfig({
  chains: [apechain],
  connectors: [
    injected(),
  ],
  transports: {
    [apechain.id]: http('https://apechain.calderachain.xyz/http'),
  },
});

