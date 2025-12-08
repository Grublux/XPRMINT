import { useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { MASTER_CRAFTER_ADDRESS } from '@/features/crafted/constants';
import type { Address } from 'viem';
import { NPC_CONTRACT_ADDRESS } from '@/config/contracts/forging';

const MASTER_CRAFTER_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getNPCForgeStats',
    inputs: [
      { name: 'collection', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [
      {
        components: [
          { name: 'positionsForged', type: 'uint64' },
          { name: 'positionsDestroyed', type: 'uint64' },
          { name: 'totalNGTLocked', type: 'uint128' },
          { name: 'totalNGTFeeEarned', type: 'uint128' },
          { name: 'totalCoalBurned', type: 'uint128' },
          { name: 'lastForgeAt', type: 'uint64' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'npcXP',
    inputs: [
      { name: 'collection', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export type NPCForgeStats = {
  positionsForged: bigint;
  positionsDestroyed: bigint;
  totalNGTLocked: bigint;
  totalNGTFeeEarned: bigint;
  totalCoalBurned: bigint;
  lastForgeAt: bigint;
};

/**
 * Hook to fetch NPC XP and stats from the MasterCrafter contract
 * 
 * XP Formula (from contract):
 * - 1 XP per 100 NGT locked
 * - +5 XP per position destroyed (completed forge cycle)
 * - +1 XP per 10 units of COAL burned
 * - +2 XP per 1 NGT of destroy fee earned
 */
export function useNPCXP(npcTokenId: bigint | number | null | undefined) {
  const tokenId = npcTokenId ? BigInt(npcTokenId) : undefined;

  const { data: xpData, isLoading: xpLoading, isError: xpError, error: xpErrorObj } = useReadContract({
    address: MASTER_CRAFTER_ADDRESS,
    abi: MASTER_CRAFTER_ABI,
    functionName: 'npcXP',
    args: tokenId !== undefined ? [NPC_CONTRACT_ADDRESS, tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  const { data: statsData, isLoading: statsLoading, isError: statsError, error: statsErrorObj } = useReadContract({
    address: MASTER_CRAFTER_ADDRESS,
    abi: MASTER_CRAFTER_ABI,
    functionName: 'getNPCForgeStats',
    args: tokenId !== undefined ? [NPC_CONTRACT_ADDRESS, tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  // Debug logging
  useEffect(() => {
    if (tokenId !== undefined) {
      console.log('[useNPCXP] Fetching XP for NPC tokenId:', tokenId.toString());
      console.log('[useNPCXP] Contract address:', MASTER_CRAFTER_ADDRESS);
      console.log('[useNPCXP] NPC contract address:', NPC_CONTRACT_ADDRESS);
      console.log('[useNPCXP] XP data:', xpData);
      console.log('[useNPCXP] Stats data:', statsData);
      if (xpError) {
        console.error('[useNPCXP] XP error:', xpErrorObj);
        console.error('[useNPCXP] Note: MasterCrafterV2 may not have npcXP function. The contract was upgraded and NPC stats tracking may have been removed.');
      }
      if (statsError) {
        console.error('[useNPCXP] Stats error:', statsErrorObj);
        console.error('[useNPCXP] Note: MasterCrafterV2 may not have getNPCForgeStats function.');
      }
    }
  }, [tokenId, xpData, statsData, xpError, statsError, xpErrorObj, statsErrorObj]);

  // Parse stats data
  let stats: NPCForgeStats | null = null;
  if (statsData) {
    if (Array.isArray(statsData)) {
      stats = {
        positionsForged: statsData[0],
        positionsDestroyed: statsData[1],
        totalNGTLocked: statsData[2],
        totalNGTFeeEarned: statsData[3],
        totalCoalBurned: statsData[4],
        lastForgeAt: statsData[5],
      };
    } else if (typeof statsData === 'object' && statsData !== null) {
      const data = statsData as any;
      stats = {
        positionsForged: typeof data.positionsForged === 'bigint' ? data.positionsForged : BigInt(String(data.positionsForged || '0')),
        positionsDestroyed: typeof data.positionsDestroyed === 'bigint' ? data.positionsDestroyed : BigInt(String(data.positionsDestroyed || '0')),
        totalNGTLocked: typeof data.totalNGTLocked === 'bigint' ? data.totalNGTLocked : BigInt(String(data.totalNGTLocked || '0')),
        totalNGTFeeEarned: typeof data.totalNGTFeeEarned === 'bigint' ? data.totalNGTFeeEarned : BigInt(String(data.totalNGTFeeEarned || '0')),
        totalCoalBurned: typeof data.totalCoalBurned === 'bigint' ? data.totalCoalBurned : BigInt(String(data.totalCoalBurned || '0')),
        lastForgeAt: typeof data.lastForgeAt === 'bigint' ? data.lastForgeAt : BigInt(String(data.lastForgeAt || '0')),
      };
    }
  }

  const xp = xpData ? Number(xpData) : 0;

  return {
    xp,
    stats,
    isLoading: xpLoading || statsLoading,
    isError: xpError || statsError,
  };
}

