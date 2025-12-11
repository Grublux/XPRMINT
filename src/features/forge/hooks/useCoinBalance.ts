import { useAccount, useReadContract } from 'wagmi';
import { CRAFTED_V4_POSITIONS_PROXY } from '@/features/crafted/constants';
import type { Address } from 'viem';

const CRAFTED_V4_POSITIONS_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'tokensOfOwner',
    inputs: [{ name: 'ownerAddr', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
] as const;

export function useCoinBalance() {
  const { address } = useAccount();

  const { data: tokens, isLoading, isError, error } = useReadContract({
    address: CRAFTED_V4_POSITIONS_PROXY,
    abi: CRAFTED_V4_POSITIONS_ABI,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: tokens ? tokens.length : 0,
    isLoading,
    isError,
    error,
  };
}

