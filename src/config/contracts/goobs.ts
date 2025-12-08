// src/config/contracts/goobs.ts
// Minimal Goobs ERC-721 config + ABI for front-end use.

import type { Address } from 'viem';

export const GOOBS_ADDRESS = '0xFC9a6FbBf61fFfB6d4faf170D3B5d1B275728117' as Address;

// Goobs contract deployment block on ApeChain
// Found via first mint transaction: https://apescan.io/tx/0x4f4c088688bc17704543a6e5d6bb0e4bb8e7cdcb12296028eb15994941b339d8
// Block: 18751204 (Jun-29-2025 08:32:03 PM +UTC)
export const GOOBS_DEPLOYMENT_BLOCK = 18751204n;

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

