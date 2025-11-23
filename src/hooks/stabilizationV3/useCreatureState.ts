import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';
import type { CreatureState } from '../../config/contracts/stabilizationV3';

export function useCreatureState(creatureId: bigint | number) {
  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'getCreatureState',
    args: [BigInt(creatureId)],
    query: {
      enabled: creatureId > 0, // Only query if creatureId is valid
    },
  });

  const parsed: CreatureState | null = useMemo(() => {
    if (!data || !Array.isArray(data)) return null;
    const [
      vibes,
      lockedCount,
      targetSal,
      targetPH,
      targetTemp,
      targetFreq,
      currSal,
      currPH,
      currTemp,
      currFreq,
      lockedSal,
      lockedPH,
      lockedTemp,
      lockedFreq,
      stabilizedAt,
      consecutiveVibeMax,
      enhancedDrip,
      bondedSP,
    ] = data;

    return {
      vibes: Number(vibes),
      lockedCount: Number(lockedCount),
      targetSal: Number(targetSal),
      targetPH: Number(targetPH),
      targetTemp: Number(targetTemp),
      targetFreq: Number(targetFreq),
      currSal: Number(currSal),
      currPH: Number(currPH),
      currTemp: Number(currTemp),
      currFreq: Number(currFreq),
      lockedSal: Boolean(lockedSal),
      lockedPH: Boolean(lockedPH),
      lockedTemp: Boolean(lockedTemp),
      lockedFreq: Boolean(lockedFreq),
      stabilizedAt: BigInt(stabilizedAt),
      consecutiveVibeMax: Number(consecutiveVibeMax),
      enhancedDrip: Boolean(enhancedDrip),
      bondedSP: Number(bondedSP),
    } satisfies CreatureState;
  }, [data]);

  return {
    state: parsed,
    isLoading,
    isError,
    error,
    refetch,
  };
}

