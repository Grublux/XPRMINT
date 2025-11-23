import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { erc1155Abi } from 'viem';
import { useMemo } from 'react';

/**
 * Hook to fetch ERC-1155 item balances for a user
 * 
 * Note: In production, itemIds should come from:
 * - Indexed events (ItemGranted, ItemApplied, ItemBurnedForSP)
 * - A subgraph/indexer
 * - Or passed as a parameter for specific items
 */
export function useItemBalances(
  itemTokenAddress: `0x${string}` | undefined,
  itemIds?: bigint[]
) {
  const { address } = useAccount();

  const balanceQueries = useReadContracts({
    contracts: (itemIds || []).map((itemId) => ({
      address: itemTokenAddress,
      abi: erc1155Abi,
      functionName: 'balanceOf',
      args: [address!, itemId],
    })),
    query: {
      enabled: !!address && !!itemTokenAddress && (itemIds?.length ?? 0) > 0,
    },
  });

  return {
    balances: balanceQueries.data?.map((result, i) => ({
      itemId: itemIds![i],
      balance: result.result as bigint,
    })) || [],
    isLoading: balanceQueries.isLoading,
    error: balanceQueries.error,
  };
}

/**
 * Hook to get item balance for a specific item ID
 */
export function useItemBalance(
  itemTokenAddress: `0x${string}` | undefined,
  itemId: bigint | undefined
) {
  const { address } = useAccount();

  return useReadContract({
    address: itemTokenAddress,
    abi: erc1155Abi,
    functionName: 'balanceOf',
    args: address && itemId ? [address, itemId] : undefined,
    query: {
      enabled: !!address && !!itemTokenAddress && !!itemId,
    },
  });
}

/**
 * Hook to get item template data from templateId (itemId = templateId in catalog system)
 */
export function useItemData(
  itemTokenAddress: `0x${string}` | undefined,
  itemId: bigint | undefined
) {
  return useReadContract({
    address: itemTokenAddress,
    abi: [
      {
        inputs: [{ name: 'itemId', type: 'uint256' }],
        name: 'getItemData',
        outputs: [
          {
            components: [
              { name: 'rarity', type: 'uint8' },
              { name: 'primaryTrait', type: 'uint8' },
              { name: 'primaryDelta', type: 'int16' }, // Magnitude (positive)
              { name: 'secondaryTrait', type: 'uint8' },
              { name: 'secondaryDelta', type: 'int16' }, // Magnitude (positive)
              { name: 'imagePtr', type: 'address' },
              { name: 'name', type: 'string' },
              { name: 'description', type: 'string' },
            ],
            name: '',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getItemData',
    args: itemId ? [itemId] : undefined,
    query: {
      enabled: !!itemTokenAddress && !!itemId,
    },
  });
}

