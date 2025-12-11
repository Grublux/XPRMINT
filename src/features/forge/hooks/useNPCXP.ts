import { useReadContract } from 'wagmi';
import { NPC_STATS_PROXY } from '@/features/crafted/constants';
import type { Address } from 'viem';

const NPC_STATS_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getNPCStatsDecoded',
    inputs: [{ name: 'npcId', type: 'uint256' }],
    outputs: [
      { name: 'totalNGTCrafted', type: 'uint64' },
      { name: 'totalNGTReturned', type: 'uint64' },
      { name: 'totalNGTFee', type: 'uint64' },
      { name: 'totalCoalBurned', type: 'uint64' },
      { name: 'crafts', type: 'uint32' },
      { name: 'destroys', type: 'uint32' },
      { name: 'name', type: 'string' },
    ],
  },
] as const;

export type NPCStats = {
  totalNGTCrafted: bigint;
  totalNGTReturned: bigint;
  totalNGTFee: bigint;
  totalCoalBurned: bigint;
  crafts: number;
  destroys: number;
  name: string;
};

/**
 * Hook to fetch NPC stats from NPCStats contract (V4)
 * 
 * Note: NPCs don't have XP - only forges do.
 * This hook returns NPC stats (crafts, destroys, NGT totals, etc.)
 */
export function useNPCXP(npcTokenId: bigint | number | null | undefined) {
  const tokenId = npcTokenId ? BigInt(npcTokenId) : undefined;

  const { data: statsData, isLoading, isError } = useReadContract({
    address: NPC_STATS_PROXY,
    abi: NPC_STATS_ABI,
    functionName: 'getNPCStatsDecoded',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  // Parse stats data
  let stats: NPCStats | null = null;
  if (statsData && Array.isArray(statsData) && statsData.length >= 7) {
    stats = {
      totalNGTCrafted: BigInt(statsData[0] || 0),
      totalNGTReturned: BigInt(statsData[1] || 0),
      totalNGTFee: BigInt(statsData[2] || 0),
      totalCoalBurned: BigInt(statsData[3] || 0),
      crafts: Number(statsData[4] || 0),
      destroys: Number(statsData[5] || 0),
      name: String(statsData[6] || ''),
    };
  }

  // NPCs don't have XP - only forges do
  // Return stats only, no XP

  return {
    stats,
    isLoading,
    isError,
  };
}

