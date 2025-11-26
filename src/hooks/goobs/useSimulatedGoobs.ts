// src/hooks/goobs/useSimulatedGoobs.ts
// Hook to fetch 6 random Goobs for simulation mode

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { GOOBS_ADDRESS, goobsAbi } from '../../config/contracts/goobs';

const STORAGE_KEY = 'simulated-goobs';

export function useSimulatedGoobs() {
  const publicClient = usePublicClient();

  // Check if this is a page reload
  const isPageReload = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const navType = navEntries[0].type;
        if (navType === 'reload' || navType === 'navigate') {
          // Clear localStorage on reload
          try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('[useSimulatedGoobs] Page reload detected - clearing simulated Goobs');
          } catch (err) {
            console.error('[useSimulatedGoobs] Failed to clear on reload:', err);
          }
          return true;
        }
      }
      
      const perfNav = (performance as any).navigation;
      if (perfNav && perfNav.type === 1) {
        try {
          localStorage.removeItem(STORAGE_KEY);
          console.log('[useSimulatedGoobs] Page reload detected - clearing simulated Goobs');
        } catch (err) {
          console.error('[useSimulatedGoobs] Failed to clear on reload:', err);
        }
        return true;
      }
    } catch (err) {
      console.error('[useSimulatedGoobs] Failed to detect navigation type:', err);
    }
    
    return false;
  }, []);

  const query = useQuery({
    queryKey: ['simulated-goobs'],
    enabled: Boolean(publicClient), // Only run when publicClient is available
    queryFn: async (): Promise<Array<{ tokenId: bigint }>> => {
      if (!publicClient) return [];

      // Only load from localStorage if NOT a page reload (tab switch)
      if (!isPageReload) {
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

