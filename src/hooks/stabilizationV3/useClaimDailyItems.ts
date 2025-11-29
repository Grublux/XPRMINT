import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useClaimDailyItems() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const claim = useCallback(
    async (creatureId: bigint | number) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'claimDailyItems',
        args: [BigInt(creatureId)],
      });
    },
    [writeContract]
  );

  return {
    claim,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}


