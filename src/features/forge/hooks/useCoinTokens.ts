import { useState, useCallback, useRef, useEffect } from 'react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { CRAFTED_V4_POSITIONS_PROXY, MASTER_CRAFTER_V4_PROXY } from '@/features/crafted/constants';
import { erc721EnumerableAbi } from '@/config/contracts/forging';
import type { Address } from 'viem';
import { parseEventLogs } from 'viem';

const MASTER_CRAFTER_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getPosition',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        components: [
          { name: 'recipeId', type: 'uint256' },
          { name: 'inputAmountLocked', type: 'uint256' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'unlockAt', type: 'uint64' },
          { name: 'owner', type: 'address' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
  },
] as const;

export type CoinToken = {
  tokenId: bigint;
  name?: string;
  imageUrl?: string;
  tokenURI?: string;
  craftedByMe?: boolean;
  ngtLocked?: bigint;
  unlockAt?: bigint;
  isLocked?: boolean;
  crafterNPCId?: bigint;
  royaltiesPercent?: number;
};

const STORAGE_KEY_PREFIX = 'coin-tokens-';

export function useCoinTokens() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [tokens, setTokens] = useState<CoinToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isScanning = useRef(false);
  const hasScanned = useRef(false);

  const getCacheKey = useCallback(() => {
    if (!address) return null;
    return `${STORAGE_KEY_PREFIX}${address}`;
  }, [address]);

  const scan = useCallback(async () => {
    if (!address || !publicClient || isScanning.current) return;
    
    isScanning.current = true;
    setIsLoading(true);

    try {
      const cacheKey = getCacheKey();
      let cachedTimestamp: number | null = null;
      let cachedTokenIds: Set<string> = new Set();
      
      // Load cache to get last scan timestamp
      if (cacheKey) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.timestamp) {
              cachedTimestamp = parsed.timestamp;
              if (parsed.tokens && Array.isArray(parsed.tokens)) {
                cachedTokenIds = new Set(parsed.tokens.map((t: any) => t.tokenId.toString()));
              }
              console.log('[useCoinTokens] Found cache from', new Date(cachedTimestamp).toISOString());
            }
          }
        } catch (err) {
          console.warn('[useCoinTokens] Failed to read cache:', err);
        }
      }
      // Use tokensOfOwner from V4 contract
      const TOKENS_OF_OWNER_ABI = [
        {
          type: 'function',
          stateMutability: 'view',
          name: 'tokensOfOwner',
          inputs: [{ name: 'ownerAddr', type: 'address' }],
          outputs: [{ name: '', type: 'uint256[]' }],
        },
      ] as const;

      console.log('[useCoinTokens] Calling tokensOfOwner on V4 contract...');
      const tokenIds = await publicClient.readContract({
        address: CRAFTED_V4_POSITIONS_PROXY,
        abi: TOKENS_OF_OWNER_ABI,
        functionName: 'tokensOfOwner',
        args: [address],
      });

      if (!tokenIds || tokenIds.length === 0) {
        setTokens([]);
        isScanning.current = false;
        setIsLoading(false);
        return;
      }

      console.log('[useCoinTokens] Found', tokenIds.length, 'tokens via tokensOfOwner');
      console.log('[useCoinTokens] Token IDs:', tokenIds.map(id => id.toString()));

      // tokensOfOwner already returns only tokens owned by the user, so we can use them directly
      const verifiedTokenIds = tokenIds;

      if (verifiedTokenIds.length === 0) {
        setTokens([]);
        isScanning.current = false;
        setIsLoading(false);
        return;
      }

      // Build token objects and fetch metadata + position data
      // Process tokens incrementally so UI updates as they load
      const foundTokens: CoinToken[] = [];
      
      // Process tokens in parallel but update UI as each completes
      const tokenPromises = verifiedTokenIds.map(async (id: bigint) => {
          let metadataUri: string;
          let originalUri: string;
          
          // Coin #1 has hardcoded metadata
          if (id === 1n) {
            metadataUri = 'https://www.xprmint.com/coins/coin1a.json';
            originalUri = metadataUri;
          } else {
            // Coins #2+ use the V4 metadata API (via our proxy route)
            metadataUri = `/api/crafted/v4/metadata/${id.toString()}`;
            originalUri = `https://xprmint-metadata-oych.vercel.app/api/crafted/v4/metadata/${id.toString()}`;
          }
          
          // Fetch position data and metadata in parallel
          const [positionResult, metadataResult] = await Promise.allSettled([
            publicClient.readContract({
              address: MASTER_CRAFTER_V4_PROXY,
              abi: MASTER_CRAFTER_ABI,
              functionName: 'getPosition',
              args: [id],
            }),
            fetch(metadataUri),
          ]);
          
          // Extract position data (optional)
          let ngtLocked: bigint | undefined;
          let unlockAt: bigint | undefined;
          let isLocked = false;
          
          if (positionResult.status === 'fulfilled' && positionResult.value && Array.isArray(positionResult.value)) {
            ngtLocked = positionResult.value[1] as bigint; // inputAmountLocked
            unlockAt = BigInt(positionResult.value[3] as number); // unlockAt (uint64)
            const currentTime = BigInt(Math.floor(Date.now() / 1000));
            isLocked = currentTime < unlockAt;
          }
          
          try {
            // Process metadata
            if (metadataResult.status === 'rejected') {
              throw metadataResult.reason;
            }
            
            const response = metadataResult.value;
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const metadata = await response.json();
            
            let imageUrl: string | undefined;
            
            // Extract image from metadata (check multiple possible fields)
            if (metadata.image) {
              imageUrl = metadata.image;
            } else if (metadata.image_data) {
              imageUrl = metadata.image_data;
            } else if (metadata.image_url) {
              imageUrl = metadata.image_url;
            }
            
            // Handle IPFS URLs
            if (imageUrl?.startsWith('ipfs://')) {
              imageUrl = `https://ipfs.io/ipfs/${imageUrl.slice(7)}`;
            }
            
            // Fallback: Try to get NGT from metadata attributes if contract call failed
            if (ngtLocked === undefined && metadata.attributes) {
              const ngtAttr = metadata.attributes.find((attr: any) => 
                attr.trait_type === 'NGT Locked' || attr.trait_type === 'NGT locked'
              );
              if (ngtAttr && ngtAttr.value) {
                // Convert to wei (assuming metadata stores in base units, not wei)
                ngtLocked = BigInt(ngtAttr.value) * 10n ** 18n;
              }
            }
            
            // Extract NPC ID and royalties from metadata
            let crafterNPCId: bigint | undefined;
            let royaltiesPercent: number | undefined;
            
            // Try multiple ways to find NPC ID
            if (metadata.attributes) {
              const npcAttr = metadata.attributes.find((attr: any) => 
                attr.trait_type === 'NPC Seat Token ID' || 
                attr.trait_type === 'NPC Token ID' || 
                attr.trait_type === 'Crafter NPC' ||
                attr.trait_type === 'NPC ID' ||
                attr.trait_type === 'Crafter'
              );
              if (npcAttr && npcAttr.value) {
                try {
                  crafterNPCId = BigInt(npcAttr.value);
                } catch (e) {
                  // Ignore parse errors
                }
              }
              
              const royaltiesAttr = metadata.attributes.find((attr: any) => 
                attr.trait_type === 'Royalties' || 
                attr.trait_type === 'Royalty' || 
                attr.trait_type === 'Royalties %' ||
                attr.trait_type === 'Royalty %'
              );
              if (royaltiesAttr && royaltiesAttr.value) {
                royaltiesPercent = typeof royaltiesAttr.value === 'number' 
                  ? royaltiesAttr.value 
                  : parseFloat(royaltiesAttr.value.toString().replace('%', ''));
              }
            }
            
            // Also check top-level metadata fields
            if (!crafterNPCId && metadata.npcId) {
              try {
                crafterNPCId = BigInt(metadata.npcId);
              } catch (e) {
                // Ignore
              }
            }
            
            if (!royaltiesPercent && metadata.royalties) {
              royaltiesPercent = typeof metadata.royalties === 'number' 
                ? metadata.royalties 
                : parseFloat(metadata.royalties.toString().replace('%', ''));
            }
            
            // Default royalties to 6.9% if not found (from CRAFTED_KERNEL.md)
            if (royaltiesPercent === undefined) {
              royaltiesPercent = 6.9;
            }

            return {
              tokenId: id,
              name: metadata.name || `Coin #${id.toString()}`,
              imageUrl,
              tokenURI: originalUri,
              craftedByMe: true, // Assume crafted by user for now - TODO: Check from contract
              ngtLocked,
              unlockAt,
              isLocked,
              crafterNPCId,
              royaltiesPercent,
            };
          } catch (err) {
            // Metadata fetch failed, return basic token info
            // Still return the token with constructed URI even if metadata fetch fails
            return {
              tokenId: id,
              name: `Coin #${id.toString()}`,
              tokenURI: originalUri,
              craftedByMe: false,
              ngtLocked,
              unlockAt,
              isLocked,
              crafterNPCId: undefined,
              royaltiesPercent: 6.9, // Default
            };
          }
      });
      
      // Process tokens as they complete to update UI incrementally
      for (const promise of tokenPromises) {
        const token = await promise;
        foundTokens.push(token);
        setTokens([...foundTokens]); // Update UI as each token loads
      }
      hasScanned.current = true;
      
      // Cache results
      if (cacheKey) {
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              timestamp: Math.floor(Date.now() / 1000),
              tokens: foundTokens.map(t => ({
                tokenId: t.tokenId.toString(),
                name: t.name,
                imageUrl: t.imageUrl,
                tokenURI: t.tokenURI,
                craftedByMe: t.craftedByMe,
                ngtLocked: t.ngtLocked?.toString(),
                unlockAt: t.unlockAt?.toString(),
                isLocked: t.isLocked,
              })),
            })
          );
          console.log('[useCoinTokens] Cached', foundTokens.length, 'tokens');
        } catch (err) {
          console.warn('[useCoinTokens] Failed to cache:', err);
        }
      }
    } catch (error) {
      console.error('[useCoinTokens] Scan failed:', error);
      setTokens([]);
    } finally {
      isScanning.current = false;
      setIsLoading(false);
    }
  }, [address, publicClient, getCacheKey]);

  // Load from cache on mount
  useEffect(() => {
    if (!address) return;
    
    const cacheKey = getCacheKey();
    if (!cacheKey) return;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.tokens && Array.isArray(parsed.tokens)) {
          const cachedTokens: CoinToken[] = parsed.tokens.map((t: any) => ({
            ...t,
            tokenId: BigInt(t.tokenId),
            ngtLocked: t.ngtLocked ? BigInt(t.ngtLocked) : undefined,
            unlockAt: t.unlockAt ? BigInt(t.unlockAt) : undefined,
          }));
          setTokens(cachedTokens);
          console.log('[useCoinTokens] Loaded', cachedTokens.length, 'tokens from cache');
        }
      }
    } catch (err) {
      console.warn('[useCoinTokens] Failed to load cache:', err);
    }
  }, [address, getCacheKey]);

  // Auto-scan on mount (after cache load)
  useEffect(() => {
    if (address && publicClient && !hasScanned.current) {
      const timer = setTimeout(() => {
        scan();
      }, 500); // Small delay to let cache load first
      return () => clearTimeout(timer);
    }
  }, [address, publicClient, scan]);

  return {
    tokens,
    isLoading,
    scan,
  };
}

async function parseImageFromUri(uri: string): Promise<string | undefined> {
  if (!uri) return undefined;
  
  console.log('[parseImageFromUri] Input:', uri.substring(0, 100) + '...');
  
  // Handle base64 encoded JSON
  if (uri.startsWith('data:application/json;base64,')) {
    try {
      const json = atob(uri.split(',')[1]);
      const metadata = JSON.parse(json);
      console.log('[parseImageFromUri] Decoded metadata:', metadata);
      let image = metadata.image || metadata.image_data;
      
      // Handle data URI images
      if (image?.startsWith('data:image/')) {
        return image;
      }
      
      // Handle IPFS images
      if (image?.startsWith('ipfs://')) {
        image = `https://ipfs.io/ipfs/${image.slice(7)}`;
      }
      
      return image;
    } catch (err) {
      console.error('[parseImageFromUri] Failed to parse base64:', err);
    }
  }
  
  // Handle IPFS - this is usually a metadata JSON, need to fetch it
  if (uri.startsWith('ipfs://')) {
    const httpUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
    try {
      const response = await fetch(httpUrl);
      const metadata = await response.json();
      console.log('[parseImageFromUri] Fetched IPFS metadata:', metadata);
      let image = metadata.image || metadata.image_data;
      
      // Handle data URI images
      if (image?.startsWith('data:image/')) {
        return image;
      }
      
      if (image?.startsWith('ipfs://')) {
        image = `https://ipfs.io/ipfs/${image.slice(7)}`;
      }
      return image;
    } catch (err) {
      console.error('[parseImageFromUri] Failed to fetch IPFS metadata:', err);
      // Maybe it's a direct image, return the URL
      return httpUrl;
    }
  }
  
  // Handle HTTP URLs - fetch the metadata
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    try {
      const response = await fetch(uri);
      const metadata = await response.json();
      console.log('[parseImageFromUri] Fetched metadata:', metadata);
      let image = metadata.image || metadata.image_data;
      
      // Handle data URI images
      if (image?.startsWith('data:image/')) {
        return image;
      }
      
      if (image?.startsWith('ipfs://')) {
        image = `https://ipfs.io/ipfs/${image.slice(7)}`;
      }
      return image;
    } catch (err) {
      console.error('[parseImageFromUri] Failed to fetch metadata:', err);
    }
  }
  
  return undefined;
}

