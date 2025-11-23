// src/hooks/stabilizationV3/useDailyItems.ts
import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export type DailyItems = {
  day: number;
  ids: bigint[];
  amounts: bigint[];
};

export function useDailyItems(creatureId: bigint | number) {
  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'getDailyItems',
    args: [BigInt(creatureId)],
  });

  const parsed: DailyItems | null = useMemo(() => {
    if (!data) return null;
    const [day, ids, amounts] = data as [bigint, bigint[], bigint[]];

    return {
      day: Number(day),
      ids: ids || [],
      amounts: amounts || [],
    };
  }, [data]);

  return {
    dailyItems: parsed,
    isLoading,
    isError,
    error,
    refetch,
  };
}
