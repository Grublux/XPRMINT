// src/config/contracts/goobs.ts
// Minimal Goobs ERC-721 config + ABI for front-end use.

import type { Address } from 'viem';

export const GOOBS_ADDRESS = '0xFC9a6FbBf61fFfB6d4faf170D3B5d1B275728117' as Address;

// Goobs contract deployment block on ApeChain
// TODO: Find actual deployment block via ApeScan or RPC
// For now, using a safe early block - update when deployment block is known
export const GOOBS_DEPLOYMENT_BLOCK = 0n; // Will be updated once we find the actual block

// NOTE: Goobs contract on ApeChain at 0xFC9a6FbBf61fFfB6d4faf170D3B5d1B275728117
// We support both enumerable and non-enumerable contracts.
export const goobsAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
] as const;

