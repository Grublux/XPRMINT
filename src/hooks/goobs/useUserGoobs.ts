// src/hooks/goobs/useUserGoobs.ts

import { useMemo, useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';

import { GOOBS_ADDRESS, GOOBS_DEPLOYMENT_BLOCK, goobsAbi } from '../../config/contracts/goobs';

export type UserGoob = {
  tokenId: bigint;
};

export type ScanProgress = {
  stage: 'balance' | 'enumerate' | 'events' | 'verify' | 'complete';
  progress: number; // 0-100
  message: string;
};

const MAX_ENUMERATE = 64n; // safety cap so we don't explode if something is weird
const STORAGE_KEY_PREFIX = 'goobs-scan-';

export function useUserGoobs() {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const [progress, setProgress] = useState<ScanProgress>({
    stage: 'balance',
    progress: 0,
    message: 'Initializing...',
  });

  const query = useQuery({
    queryKey: ['user-goobs', address, GOOBS_ADDRESS, chain?.id],
    enabled: Boolean(address && publicClient),
    queryFn: async () => {
      if (!address || !publicClient) return [] as UserGoob[];

      console.log('[useUserGoobs] Checking Goobs for address:', address, 'on chain:', chain?.id, chain?.name);
      console.log('[useUserGoobs] Goobs contract address:', GOOBS_ADDRESS);

      // Helper to get/set cached data
      const getCacheKey = () => `${STORAGE_KEY_PREFIX}${address}-${chain?.id}`;
      const getCachedData = (): { goobs: UserGoob[]; lastBlock: bigint } | null => {
        try {
          const cached = localStorage.getItem(getCacheKey());
          if (cached) {
            const parsed = JSON.parse(cached);
            return {
              goobs: parsed.goobs.map((g: { tokenId: string }) => ({ tokenId: BigInt(g.tokenId) })),
              lastBlock: BigInt(parsed.lastBlock),
            };
          }
        } catch {}
        return null;
      };
      const setCachedData = (goobs: UserGoob[], lastBlock: bigint) => {
        try {
          localStorage.setItem(
            getCacheKey(),
            JSON.stringify({
              goobs: goobs.map((g) => ({ tokenId: g.tokenId.toString() })),
              lastBlock: lastBlock.toString(),
            })
          );
        } catch {}
      };

      // 1) Read balance
      setProgress({ stage: 'balance', progress: 10, message: 'Checking wallet balance...' });
      // Force a micro-task to allow React to render
      await new Promise(resolve => setTimeout(resolve, 10));
      let balance: bigint;
      try {
        balance = await publicClient.readContract({
          address: GOOBS_ADDRESS,
          abi: goobsAbi,
          functionName: 'balanceOf',
          args: [address as Address],
        });
        console.log('[useUserGoobs] balanceOf result:', balance.toString());
      } catch (err) {
        console.error('[useUserGoobs] balanceOf failed:', err);
        setProgress({ stage: 'complete', progress: 100, message: 'Error checking balance' });
        return [] as UserGoob[];
      }

      if (balance === 0n) {
        console.log('[useUserGoobs] balance is 0, returning empty list');
        setProgress({ stage: 'complete', progress: 100, message: 'No Goobs found' });
        return [] as UserGoob[];
      }

      // Check cache first
      const cached = getCachedData();
      const currentBlock = await publicClient.getBlockNumber();
      
      if (cached && cached.goobs.length > 0) {
        // We have cached data - only scan from last block
        setProgress({ stage: 'events', progress: 20, message: 'Scanning for new transfers...' });
        
        try {
          // Only scan from last cached block to current
          const fromBlock = cached.lastBlock + 1n;
          if (fromBlock <= currentBlock) {
            const newTransferLogs = await publicClient.getLogs({
              address: GOOBS_ADDRESS,
              event: {
                type: 'event',
                name: 'Transfer',
                inputs: [
                  { type: 'address', indexed: true, name: 'from' },
                  { type: 'address', indexed: true, name: 'to' },
                  { type: 'uint256', indexed: true, name: 'tokenId' },
                ],
              },
              args: {
                to: address as Address,
              },
              fromBlock: fromBlock,
              toBlock: currentBlock,
            });

            console.log('[useUserGoobs] Found', newTransferLogs.length, 'new Transfer events since last scan');

            // Merge new tokens with cached
            const allReceivedTokens = new Set<bigint>(cached.goobs.map((g) => g.tokenId));
            for (const log of newTransferLogs) {
              if (log.args.tokenId !== undefined) {
                allReceivedTokens.add(BigInt(log.args.tokenId));
              }
            }

            // Verify ownership of all tokens (cached + new)
            setProgress({ stage: 'verify', progress: 60, message: 'Verifying ownership...' });
            const ownedTokens: bigint[] = [];
            const tokenArray = Array.from(allReceivedTokens);
            const ownerChecks = tokenArray.map(async (tokenId, idx) => {
              try {
                const owner = await publicClient.readContract({
                  address: GOOBS_ADDRESS,
                  abi: goobsAbi,
                  functionName: 'ownerOf',
                  args: [tokenId],
                });
                setProgress({
                  stage: 'verify',
                  progress: 60 + Math.floor((idx / tokenArray.length) * 30),
                  message: `Verifying token ${idx + 1} of ${tokenArray.length}...`,
                });
                if (owner.toLowerCase() === address.toLowerCase()) {
                  return tokenId;
                }
                return null;
              } catch {
                return null;
              }
            });

            const results = await Promise.all(ownerChecks);
            for (const tokenId of results) {
              if (tokenId !== null) {
                ownedTokens.push(tokenId);
              }
            }

            setProgress({ stage: 'complete', progress: 100, message: 'Complete!' });
            setCachedData(ownedTokens.map((id) => ({ tokenId: id })), currentBlock);
            console.log('[useUserGoobs] Found Goobs (cached + incremental):', ownedTokens.map(id => id.toString()));
            return ownedTokens.map((id) => ({ tokenId: id }));
          } else {
            // No new blocks, return cached
            setProgress({ stage: 'complete', progress: 100, message: 'Using cached data' });
            return cached.goobs;
          }
        } catch (err) {
          console.warn('[useUserGoobs] Incremental scan failed, falling back to full scan:', err);
          // Fall through to full scan
        }
      }

      // Full scan (first time or incremental failed)
      setProgress({ stage: 'enumerate', progress: 20, message: 'Attempting enumeration...' });
      await new Promise(resolve => setTimeout(resolve, 0)); // Allow React to render progress
      const capped = balance > MAX_ENUMERATE ? MAX_ENUMERATE : balance;
      console.log('[useUserGoobs] Attempting to enumerate', capped.toString(), 'tokens');

      // 2) Attempt enumeration via tokenOfOwnerByIndex.
      const requests: Promise<bigint>[] = [];
      for (let i = 0n; i < capped; i++) {
        requests.push(
          publicClient.readContract({
            address: GOOBS_ADDRESS,
            abi: goobsAbi,
            functionName: 'tokenOfOwnerByIndex',
            args: [address as Address, i],
          })
        );
      }

      try {
        const ids = await Promise.all(requests);
        console.log('[useUserGoobs] Successfully enumerated tokenIds:', ids.map(id => id.toString()));
        setProgress({ stage: 'complete', progress: 100, message: 'Complete!' });
        const result = ids.map((id) => ({ tokenId: id }));
        setCachedData(result, currentBlock);
        return result;
      } catch (err) {
        // If enumeration fails (no ERC-721Enumerable), use Transfer events
        console.warn('[useUserGoobs] tokenOfOwnerByIndex failed, contract is not enumerable. Using Transfer events instead.');
        
        try {
          setProgress({ stage: 'events', progress: 30, message: 'Querying Transfer events...' });
          await new Promise(resolve => setTimeout(resolve, 10)); // Allow React to render
          
          // Use deployment block as start, or last 100k blocks if deployment block is 0
          // If deployment block is 0, we'll find it by scanning backwards from first Transfer event
          let fromBlock = GOOBS_DEPLOYMENT_BLOCK > 0n 
            ? GOOBS_DEPLOYMENT_BLOCK 
            : (currentBlock > 100000n ? currentBlock - 100000n : 0n);
          
          // If we don't have deployment block, try to find it by getting first Transfer event
          if (GOOBS_DEPLOYMENT_BLOCK === 0n && fromBlock > 0n) {
            setProgress({ stage: 'events', progress: 35, message: 'Finding contract deployment block...' });
            try {
              // Get first Transfer event to find deployment block
              const firstLogs = await publicClient.getLogs({
                address: GOOBS_ADDRESS,
                event: {
                  type: 'event',
                  name: 'Transfer',
                  inputs: [
                    { type: 'address', indexed: true, name: 'from' },
                    { type: 'address', indexed: true, name: 'to' },
                    { type: 'uint256', indexed: true, name: 'tokenId' },
                  ],
                },
                fromBlock: 0n,
                toBlock: currentBlock,
              });
              
              // Just use the first one
              if (firstLogs.length > 0 && firstLogs[0].blockNumber) {
                // Use the block before the first Transfer as deployment block (contract deployed, then first mint)
                fromBlock = firstLogs[0].blockNumber > 0n ? firstLogs[0].blockNumber - 1n : 0n;
                console.log('[useUserGoobs] Found deployment block:', fromBlock.toString());
              }
            } catch (err) {
              console.warn('[useUserGoobs] Could not find deployment block, using fallback:', err);
            }
          }
          
          setProgress({ stage: 'events', progress: 40, message: `Scanning from block ${fromBlock.toString()}...` });
          await new Promise(resolve => setTimeout(resolve, 10));
          
          const transferLogs = await publicClient.getLogs({
            address: GOOBS_ADDRESS,
            event: {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { type: 'address', indexed: true, name: 'from' },
                { type: 'address', indexed: true, name: 'to' },
                { type: 'uint256', indexed: true, name: 'tokenId' },
              ],
            },
            args: {
              to: address as Address,
            },
            fromBlock: fromBlock,
            toBlock: currentBlock,
          });

          console.log('[useUserGoobs] Found', transferLogs.length, 'Transfer events to this address');
          setProgress({ stage: 'verify', progress: 60, message: 'Processing transfers...' });

          // Get all tokenIds that were transferred TO this address
          const receivedTokens = new Set<bigint>();
          for (const log of transferLogs) {
            if (log.args.tokenId !== undefined) {
              receivedTokens.add(BigInt(log.args.tokenId));
            }
          }

          // Now check which ones are still owned (might have been transferred out)
          setProgress({ stage: 'verify', progress: 70, message: 'Verifying ownership...' });
          const ownedTokens: bigint[] = [];
          const tokenArray = Array.from(receivedTokens);
          const ownerChecks = tokenArray.map(async (tokenId, idx) => {
            try {
              const owner = await publicClient.readContract({
                address: GOOBS_ADDRESS,
                abi: goobsAbi,
                functionName: 'ownerOf',
                args: [tokenId],
              });
              setProgress({
                stage: 'verify',
                progress: 70 + Math.floor((idx / tokenArray.length) * 25),
                message: `Verifying token ${idx + 1} of ${tokenArray.length}...`,
              });
              if (owner.toLowerCase() === address.toLowerCase()) {
                return tokenId;
              }
              return null;
            } catch {
              return null;
            }
          });

          const results = await Promise.all(ownerChecks);
          for (const tokenId of results) {
            if (tokenId !== null) {
              ownedTokens.push(tokenId);
            }
          }

          setProgress({ stage: 'complete', progress: 100, message: 'Complete!' });
          const result = ownedTokens.map((id) => ({ tokenId: id }));
          setCachedData(result, currentBlock);
          console.log('[useUserGoobs] Found Goobs via Transfer events:', ownedTokens.map(id => id.toString()));
          return result;
        } catch (fallbackErr) {
          console.error('[useUserGoobs] Transfer events method failed:', fallbackErr);
          setProgress({ stage: 'complete', progress: 100, message: 'Error scanning' });
          return [] as UserGoob[];
        }
      }
    },
  });

  const goobs = useMemo(() => query.data ?? [], [query.data]);

  // Reset progress when query completes or starts
  useEffect(() => {
    if (query.isLoading) {
      setProgress({ stage: 'balance', progress: 0, message: 'Initializing...' });
    } else if (query.data) {
      setProgress({ stage: 'complete', progress: 100, message: 'Complete!' });
    }
  }, [query.isLoading, query.data]);

  return {
    goobs,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    progress,
  };
}

