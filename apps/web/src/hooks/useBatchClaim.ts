import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useCallback } from 'react';

const STABILIZER_ABI = [
  {
    inputs: [{ name: 'creatureIds', type: 'uint256[]' }],
    name: 'claimDailyItemsBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

/**
 * Hook to batch claim daily items for multiple creatures
 * 
 * @param stabilizerAddress Address of CreatureStabilizer contract
 * @returns Object with claimBatch function and transaction state
 */
export function useBatchClaim(stabilizerAddress: `0x${string}` | undefined) {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, error, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimBatch = useCallback(
    (creatureIds: bigint[]) => {
      if (!stabilizerAddress || !isConnected || !address) {
        console.error('Cannot claim: missing stabilizer address or wallet not connected');
        return;
      }

      if (creatureIds.length === 0) {
        console.error('Cannot claim: no creature IDs provided');
        return;
      }

      writeContract({
        address: stabilizerAddress,
        abi: STABILIZER_ABI,
        functionName: 'claimDailyItemsBatch',
        args: [creatureIds],
      });
    },
    [stabilizerAddress, isConnected, address, writeContract]
  );

  return {
    claimBatch,
    hash,
    error,
    isPending,
    isConfirming,
    isSuccess,
    reset,
  };
}

