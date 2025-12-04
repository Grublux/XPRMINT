import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useBurnItemForSP() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const burnForSP = useCallback(
    async (creatureId: bigint | number, itemId: bigint | number) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'burnItemForSP',
        args: [BigInt(creatureId), BigInt(itemId)],
      });
    },
    [writeContract]
  );

  return {
    burnForSP,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}



