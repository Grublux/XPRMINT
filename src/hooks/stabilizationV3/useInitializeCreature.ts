import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export type InitializeCreatureArgs = {
  creatureId: bigint | number;
  targetSal: number;
  targetPH: number;
  targetTemp: number;
  targetFreq: number;
  currSal: number;
  currPH: number;
  currTemp: number;
  currFreq: number;
};

export function useInitializeCreature() {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const [submitted, setSubmitted] = useState(false);

  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const initialize = useCallback(
    async (args: InitializeCreatureArgs) => {
      if (!address) throw new Error('Wallet not connected');
      setSubmitted(false);

      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'initializeCreature',
        args: [
          BigInt(args.creatureId),
          args.targetSal,
          args.targetPH,
          args.targetTemp,
          args.targetFreq,
          args.currSal,
          args.currPH,
          args.currTemp,
          args.currFreq,
        ],
      });

      setSubmitted(true);
    },
    [address, writeContract]
  );

  return {
    initialize,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
    submitted,
  };
}

