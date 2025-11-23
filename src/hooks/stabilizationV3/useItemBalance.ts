import { useAccount, useReadContract } from 'wagmi';
import { ITEM_V3_ADDRESS, itemToken1155V3Abi } from '../../config/contracts/stabilizationV3';

export function useItemBalance(tokenId: bigint | number, addressOverride?: `0x${string}`) {
  const { address } = useAccount();
  const target = addressOverride ?? address;

  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: ITEM_V3_ADDRESS,
    abi: itemToken1155V3Abi,
    functionName: 'balanceOf',
    args: target ? [target, BigInt(Number(tokenId))] : undefined,
    query: {
      enabled: !!target,
    },
  });

  return {
    balance: data ? (typeof data === 'bigint' ? data : BigInt(String(data))) : 0n,
    isLoading,
    isError,
    error,
    refetch,
  };
}

