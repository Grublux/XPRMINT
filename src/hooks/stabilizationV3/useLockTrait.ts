import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

// traitIndex: 0 = sal, 1 = pH, 2 = temp, 3 = freq
export function useLockTrait() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const lockTrait = useCallback(
    async (creatureId: bigint | number, traitIndex: 0 | 1 | 2 | 3) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'lockTrait',
        args: [BigInt(creatureId), traitIndex],
      });
    },
    [writeContract]
  );

  return {
    lockTrait,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}

