import { defineChain } from 'viem';

export const apechain = defineChain({
  id: 33139,
  name: 'ApeChain',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://apechain.calderachain.xyz/http'],
    },
    public: {
      http: ['https://apechain.calderachain.xyz/http'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ApeScan',
      url: 'https://apescan.io',
    },
  },
});

