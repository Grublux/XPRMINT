// src/hooks/goobs/useSimulatedGoobs.ts
// Hook to fetch 6 random Goobs for simulation mode

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { GOOBS_ADDRESS, goobsAbi } from '../../config/contracts/goobs';

const STORAGE_KEY = 'simulated-goobs';

export function useSimulatedGoobs() {
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ['simulated-goobs'],
    enabled: Boolean(publicClient), // Only run when publicClient is available
    queryFn: async (): Promise<Array<{ tokenId: bigint }>> => {
      if (!publicClient) return [];

      // Try to load from localStorage first
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const ids = JSON.parse(stored) as string[];
          if (ids.length > 0) {
            console.log('[useSimulatedGoobs] Loading from localStorage:', ids);
            return ids.map(id => ({ tokenId: BigInt(id) }));
          }
        }
      } catch (err) {
        console.error('[useSimulatedGoobs] Failed to load from localStorage:', err);
      }

      // Generate new random Goobs if not in localStorage
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

        // Pick 6 random token IDs
        const randomIds: bigint[] = [];
        const used = new Set<string>();
        
        while (randomIds.length < 6 && randomIds.length < Number(totalSupply)) {
          // Generate random number between 0 and totalSupply - 1
          const randomIndex = Math.floor(Math.random() * Number(totalSupply));
          const tokenId = BigInt(randomIndex);
          const key = tokenId.toString();
          
          if (!used.has(key)) {
            used.add(key);
            randomIds.push(tokenId);
          }
        }

        const goobs = randomIds.map(tokenId => ({ tokenId }));
        
        // Persist to localStorage
        try {
          const ids = goobs.map(g => g.tokenId.toString());
          localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
          console.log('[useSimulatedGoobs] Generated and saved new simulated Goobs:', ids);
        } catch (err) {
          console.error('[useSimulatedGoobs] Failed to save to localStorage:', err);
        }

        return goobs;
      } catch (err) {
        console.error('[useSimulatedGoobs] Failed to fetch random Goobs:', err);
        return [];
      }
    },
    staleTime: Infinity, // Never consider the data stale
    gcTime: Infinity, // Never garbage collect
  });

  return {
    goobs: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

