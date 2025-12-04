import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { NPC_CONTRACT_ADDRESS } from '../../config/contracts/forging';

export type NPCToken = {
  tokenId: bigint;
  tokenURI?: string;
  imageUrl?: string;
  name?: string;
};

export type ScanProgress = {
  stage: 'idle' | 'scanning' | 'metadata' | 'complete' | 'error';
  progress: number;
  message: string;
};

const STORAGE_KEY_PREFIX = 'npc-tokens-';
// NPC deployed Nov 2024 - start from a recent block to avoid timeout
const NPC_DEPLOYMENT_BLOCK = 28_000_000n;

const npcAbi = [
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function useNPCTokens() {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  
  const [tokens, setTokens] = useState<NPCToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>({
    stage: 'idle',
    progress: 0,
    message: '',
  });
  
  const hasScanned = useRef(false);
  const isScanning = useRef(false);

  const getCacheKey = useCallback(() => `${STORAGE_KEY_PREFIX}${address}-${chain?.id}`, [address, chain?.id]);

  // Core scan function using on-chain event logs
  const doScan = useCallback(async (showProgress: boolean) => {
    if (!address || !publicClient || isScanning.current) return;
    
    isScanning.current = true;
    if (showProgress) setIsLoading(true);
    if (showProgress) setProgress({ stage: 'scanning', progress: 10, message: 'Checking balance...' });

    try {
      // First check balance
      let balance: bigint;
      try {
        balance = await publicClient.readContract({
          address: NPC_CONTRACT_ADDRESS,
          abi: npcAbi,
          functionName: 'balanceOf',
          args: [address],
        });
        console.log('[useNPCTokens] Balance:', balance.toString());
      } catch (err) {
        console.error('[useNPCTokens] balanceOf failed:', err);
        if (showProgress) setProgress({ stage: 'error', progress: 100, message: 'Could not check balance' });
        isScanning.current = false;
        if (showProgress) setIsLoading(false);
        return;
      }

      if (balance === 0n) {
        setTokens([]);
        hasScanned.current = true;
        if (showProgress) setProgress({ stage: 'complete', progress: 100, message: 'No NPCs found' });
        isScanning.current = false;
        if (showProgress) setIsLoading(false);
        return;
      }

      if (showProgress) setProgress({ stage: 'scanning', progress: 30, message: 'Scanning transfers...' });

      // Scan Transfer events
      const currentBlock = await publicClient.getBlockNumber();
      console.log('[useNPCTokens] Scanning from block', NPC_DEPLOYMENT_BLOCK.toString(), 'to', currentBlock.toString());

      const [receivedLogs, sentLogs] = await Promise.all([
        publicClient.getLogs({
          address: NPC_CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: true, name: 'tokenId' },
            ],
          },
          args: { to: address },
          fromBlock: NPC_DEPLOYMENT_BLOCK,
          toBlock: currentBlock,
        }),
        publicClient.getLogs({
          address: NPC_CONTRACT_ADDRESS,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: true, name: 'tokenId' },
            ],
          },
          args: { from: address },
          fromBlock: NPC_DEPLOYMENT_BLOCK,
          toBlock: currentBlock,
        }),
      ]);

      console.log('[useNPCTokens] Received logs:', receivedLogs.length, 'Sent logs:', sentLogs.length);

      const tokenIds = new Set<bigint>();
      
      for (const log of receivedLogs) {
        if (log.args.tokenId !== undefined) {
          tokenIds.add(log.args.tokenId as bigint);
          console.log('[useNPCTokens] Received token:', (log.args.tokenId as bigint).toString());
        }
      }
      for (const log of sentLogs) {
        if (log.args.tokenId !== undefined) {
          tokenIds.delete(log.args.tokenId as bigint);
          console.log('[useNPCTokens] Sent token:', (log.args.tokenId as bigint).toString());
        }
      }

      console.log('[useNPCTokens] Candidate token IDs:', Array.from(tokenIds).map(id => id.toString()));

      if (showProgress) setProgress({ stage: 'scanning', progress: 60, message: 'Verifying ownership...' });

      // Verify ownership
      const foundTokens: NPCToken[] = [];
      for (const tokenId of tokenIds) {
        try {
          const owner = await publicClient.readContract({
            address: NPC_CONTRACT_ADDRESS,
            abi: npcAbi,
            functionName: 'ownerOf',
            args: [tokenId],
          });
          console.log('[useNPCTokens] Token', tokenId.toString(), 'owner:', owner);
          if ((owner as string).toLowerCase() === address.toLowerCase()) {
            foundTokens.push({ tokenId, name: `NPC #${tokenId.toString()}` });
          }
        } catch (err) {
          console.error('[useNPCTokens] ownerOf failed for token', tokenId.toString(), err);
        }
      }

      console.log('[useNPCTokens] Verified tokens:', foundTokens.length);

      if (foundTokens.length === 0) {
        setTokens([]);
        hasScanned.current = true;
        if (showProgress) setProgress({ stage: 'complete', progress: 100, message: 'No NPCs found' });
        isScanning.current = false;
        if (showProgress) setIsLoading(false);
        return;
      }

      // Fetch metadata
      if (showProgress) setProgress({ stage: 'metadata', progress: 80, message: 'Loading images...' });
      
      await Promise.all(
        foundTokens.map(async (token) => {
          try {
            const uri = await publicClient.readContract({
              address: NPC_CONTRACT_ADDRESS,
              abi: npcAbi,
              functionName: 'tokenURI',
              args: [token.tokenId],
            });
            console.log('[useNPCTokens] tokenURI for', token.tokenId.toString(), ':', uri);
            token.tokenURI = uri as string;
            token.imageUrl = await parseImageFromUri(uri as string);
            console.log('[useNPCTokens] Parsed image URL:', token.imageUrl);
          } catch (err) {
            console.error('[useNPCTokens] tokenURI failed for', token.tokenId.toString(), err);
          }
        })
      );

      setTokens(foundTokens);
      hasScanned.current = true;
      if (showProgress) setProgress({ stage: 'complete', progress: 100, message: `Found ${foundTokens.length} NPC(s)` });

      // Cache
      try {
        localStorage.setItem(
          getCacheKey(),
          JSON.stringify({
            tokens: foundTokens.map(t => ({
              tokenId: t.tokenId.toString(),
              imageUrl: t.imageUrl,
              name: t.name,
            })),
          })
        );
      } catch {}

    } catch (err) {
      console.error('[useNPCTokens] Scan failed:', err);
      if (showProgress) setProgress({ stage: 'error', progress: 100, message: 'Scan failed' });
    } finally {
      isScanning.current = false;
      if (showProgress) setIsLoading(false);
    }
  }, [address, publicClient, getCacheKey]);

  // Auto-scan on mount
  useEffect(() => {
    if (address && publicClient && !hasScanned.current) {
      const timer = setTimeout(() => {
        doScan(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [address, publicClient, doScan]);

  // Manual scan
  const scan = useCallback(() => {
    if (hasScanned.current && tokens.length > 0) {
      setProgress({ stage: 'complete', progress: 100, message: `Found ${tokens.length} NPC(s)` });
      return;
    }
    doScan(true);
  }, [doScan, tokens.length]);

  return {
    tokens,
    balance: tokens.length,
    isLoading,
    hasNPCs: tokens.length > 0,
    progress,
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
      let image = metadata.image;
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
      let image = metadata.image;
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
      let image = metadata.image;
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
