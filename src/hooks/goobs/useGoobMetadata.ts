// src/hooks/goobs/useGoobMetadata.ts
// Hook to fetch Goob NFT metadata (image, traits, etc.)

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { GOOBS_ADDRESS, goobsAbi } from '../../config/contracts/goobs';

const STORAGE_KEY_PREFIX = 'goob-metadata-';

export type GoobMetadata = {
  name?: string;
  description?: string;
  image?: string;
  image_data?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  // Essence traits (if structured differently)
  essence?: {
    [key: string]: string | number;
  };
};

export function useGoobMetadata(tokenId: bigint | null) {
  const publicClient = usePublicClient();

  const getCacheKey = () => `${STORAGE_KEY_PREFIX}${GOOBS_ADDRESS}-${tokenId?.toString()}`;
  
  const getCachedMetadata = (): GoobMetadata | null => {
    if (tokenId === null) return null;
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (cached) {
        return JSON.parse(cached) as GoobMetadata;
      }
    } catch {}
    return null;
  };

  const setCachedMetadata = (metadata: GoobMetadata) => {
    if (tokenId === null) return;
    try {
      localStorage.setItem(getCacheKey(), JSON.stringify(metadata));
    } catch {}
  };

  const query = useQuery({
    queryKey: ['goob-metadata', GOOBS_ADDRESS, tokenId?.toString()],
    enabled: Boolean(tokenId !== null && publicClient),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    queryFn: async (): Promise<GoobMetadata | null> => {
      if (tokenId === null || !publicClient) return null;

      // Check cache first
      const cached = getCachedMetadata();
      if (cached) {
        // Return cached data immediately, but still fetch in background to update if needed
        // We'll use staleTime to control this behavior
      }

      try {
        // Fetch tokenURI from contract
        const tokenURI = await publicClient.readContract({
          address: GOOBS_ADDRESS,
          abi: goobsAbi,
          functionName: 'tokenURI',
          args: [tokenId],
        });

        if (!tokenURI || tokenURI === '') {
          console.warn('[useGoobMetadata] Empty tokenURI for token', tokenId.toString());
          return null;
        }

        // Handle data URI (base64 encoded JSON)
        let jsonString: string;
        if (tokenURI.startsWith('data:application/json;base64,')) {
          const base64 = tokenURI.replace('data:application/json;base64,', '');
          jsonString = atob(base64);
        } else if (tokenURI.startsWith('data:application/json,')) {
          jsonString = decodeURIComponent(tokenURI.replace('data:application/json,', ''));
        } else if (tokenURI.startsWith('http://') || tokenURI.startsWith('https://')) {
          // Fetch from HTTP URL
          const response = await fetch(tokenURI);
          if (!response.ok) {
            throw new Error(`Failed to fetch metadata: ${response.statusText}`);
          }
          jsonString = await response.text();
        } else {
          // Assume it's already JSON
          jsonString = tokenURI;
        }

        const metadata = JSON.parse(jsonString) as GoobMetadata;
        
        // Extract essence traits if they're in attributes
        if (metadata.attributes) {
          const essence: Record<string, string | number> = {};
          for (const attr of metadata.attributes) {
            if (attr.trait_type.toLowerCase().includes('essence') || 
                attr.trait_type.toLowerCase().includes('trait')) {
              essence[attr.trait_type] = attr.value;
            }
          }
          if (Object.keys(essence).length > 0) {
            metadata.essence = essence;
          }
        }

        // Cache the metadata
        setCachedMetadata(metadata);

        return metadata;
      } catch (err) {
        console.error('[useGoobMetadata] Failed to fetch metadata:', err);
        return null;
      }
    },
  });

  // Return cached data immediately if available, otherwise use query data
  const cachedMetadata = tokenId !== null ? getCachedMetadata() : null;
  const metadata = query.data ?? cachedMetadata;

  // Preload image if metadata is available
  React.useEffect(() => {
    if (metadata?.image) {
      const img = new Image();
      img.src = metadata.image;
    } else if (metadata?.image_data) {
      const img = new Image();
      img.src = metadata.image_data;
    }
  }, [metadata?.image, metadata?.image_data]);

  return {
    metadata,
    isLoading: query.isLoading && !cachedMetadata, // Don't show loading if we have cached data
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

