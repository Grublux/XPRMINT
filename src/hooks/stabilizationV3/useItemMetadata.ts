// src/hooks/stabilizationV3/useItemMetadata.ts
// Hook to fetch item metadata (image, name, etc.) from ItemToken1155

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { ITEM_V3_ADDRESS, itemToken1155V3Abi } from '../../config/contracts/stabilizationV3';

export type ItemMetadata = {
  name?: string;
  description?: string;
  image?: string;
  image_data?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
};

export function useItemMetadata(itemId: number | null) {
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ['item-metadata', ITEM_V3_ADDRESS, itemId?.toString()],
    enabled: Boolean(itemId !== null && publicClient),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    queryFn: async (): Promise<ItemMetadata | null> => {
      if (itemId === null || !publicClient) return null;

             try {
               // Fetch uri from contract (ERC-1155 uses uri(uint256) instead of tokenURI)
               const tokenURI = await publicClient.readContract({
                 address: ITEM_V3_ADDRESS,
                 abi: itemToken1155V3Abi,
                 functionName: 'uri',
                 args: [BigInt(itemId)],
               }) as string;

               if (!tokenURI || tokenURI === '') {
                 console.warn('[useItemMetadata] Empty uri for item', itemId);
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

               const metadata = JSON.parse(jsonString) as ItemMetadata;
               return metadata;
      } catch (err) {
        console.error('[useItemMetadata] Failed to fetch metadata:', err);
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

