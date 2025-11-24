// src/hooks/goobs/useSimulatedGoobs.ts
// Hook to fetch 5 random Goobs for simulation mode

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { GOOBS_ADDRESS, goobsAbi } from '../../config/contracts/goobs';

export function useSimulatedGoobs() {
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ['simulated-goobs'],
    enabled: Boolean(publicClient), // Only run when publicClient is available
    queryFn: async (): Promise<Array<{ tokenId: bigint }>> => {
      if (!publicClient) return [];

      try {
        // Get total supply
        const totalSupply = await publicClient.readContract({
          address: GOOBS_ADDRESS,
          abi: goobsAbi,
          functionName: 'totalSupply',
        }) as bigint;

        if (totalSupply === 0n) {
          return [];
        }

        // Pick 5 random token IDs
        const randomIds: bigint[] = [];
        const used = new Set<string>();
        
        while (randomIds.length < 5 && randomIds.length < Number(totalSupply)) {
          // Generate random number between 0 and totalSupply - 1
          const randomIndex = Math.floor(Math.random() * Number(totalSupply));
          const tokenId = BigInt(randomIndex);
          const key = tokenId.toString();
          
          if (!used.has(key)) {
            used.add(key);
            randomIds.push(tokenId);
          }
        }

        return randomIds.map(tokenId => ({ tokenId }));
      } catch (err) {
        console.error('[useSimulatedGoobs] Failed to fetch random Goobs:', err);
        return [];
      }
    },
  });

  return {
    goobs: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

