import { useAccount, useReadContract } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useWalletSP(addressOverride?: `0x${string}`) {
  const { address } = useAccount();
  const target = addressOverride ?? address;

  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'walletSP',
    args: target ? [target] : undefined,
    query: {
      enabled: !!target,
    },
  });

  return {
    sp: data ? Number(data) : 0,
    isLoading,
    isError,
    error,
    refetch,
  };
}



