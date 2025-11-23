// src/hooks/goobs/useGoobMetadata.ts
// Hook to fetch Goob NFT metadata (image, traits, etc.)

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { GOOBS_ADDRESS, goobsAbi } from '../../config/contracts/goobs';
import type { Address } from 'viem';

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

  const query = useQuery({
    queryKey: ['goob-metadata', GOOBS_ADDRESS, tokenId?.toString()],
    enabled: Boolean(tokenId !== null && publicClient),
    queryFn: async (): Promise<GoobMetadata | null> => {
      if (tokenId === null || !publicClient) return null;

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

        return metadata;
      } catch (err) {
        console.error('[useGoobMetadata] Failed to fetch metadata:', err);
        return null;
      }
    },
  });

  return {
    metadata: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

