// src/hooks/stabilizationV3/useWalletItemsSummary.ts
// Simple read-only summary of the user's item balances for IDs 0-63.

import { useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';

import { ITEM_V3_ADDRESS, itemToken1155V3Abi } from '../../config/contracts/stabilizationV3';

export type WalletItem = {
  id: number;
  balance: bigint;
};

const ITEM_IDS: bigint[] = Array.from({ length: 64 }, (_, i) => BigInt(i));

export function useWalletItemsSummary() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ['wallet-items-summary', address, ITEM_V3_ADDRESS],
    enabled: Boolean(address && publicClient),
    queryFn: async () => {
      if (!address || !publicClient) return [] as WalletItem[];

      const balances = await Promise.all(
        ITEM_IDS.map(async (id) => {
          try {
            const bal = await publicClient.readContract({
              address: ITEM_V3_ADDRESS,
              abi: itemToken1155V3Abi,
              functionName: 'balanceOf',
              args: [address as Address, id],
            });
            return { id: Number(id), balance: bal as bigint };
          } catch (err) {
            console.warn('[useWalletItemsSummary] balanceOf failed for id', id, err);
            return { id: Number(id), balance: 0n };
          }
        })
      );

      return balances.filter((b) => b.balance > 0n);
    },
  });

  const items = useMemo(() => query.data ?? [], [query.data]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

