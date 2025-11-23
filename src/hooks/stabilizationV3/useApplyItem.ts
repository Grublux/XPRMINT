import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useApplyItem() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const applyItem = useCallback(
    async (creatureId: bigint | number, itemId: bigint | number) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'applyItem',
        args: [BigInt(creatureId), BigInt(itemId)],
      });
    },
    [writeContract]
  );

  return {
    applyItem,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}

