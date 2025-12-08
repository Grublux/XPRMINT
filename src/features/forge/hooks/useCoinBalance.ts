import { useAccount, useReadContract } from 'wagmi';
import { POSITIONS_ADDRESS } from '@/features/crafted/constants';
import type { Address } from 'viem';

const POSITIONS_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function useCoinBalance() {
  const { address } = useAccount();

  const { data: balance, isLoading, isError, error } = useReadContract({
    address: POSITIONS_ADDRESS,
    abi: POSITIONS_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: balance ? Number(balance) : 0,
    isLoading,
    isError,
    error,
  };
}

