// src/components/stabilization/TraitsPanel.tsx

import React from 'react';
import { useAccount } from 'wagmi';
import { useCreatureState } from '../../hooks/stabilizationV3/useCreatureState';
import styles from './TraitsPanel.module.css';

const TRAIT_LABELS = ['Salinity', 'pH', 'Temperature', 'Frequency'];

interface TraitsPanelProps {
  creatureId: bigint | null;
}

export const TraitsPanel: React.FC<TraitsPanelProps> = ({ creatureId }) => {
  const { address } = useAccount();
  const enabled = creatureId !== null;
  const { state, isLoading, isError } = useCreatureState(
    enabled && creatureId !== null ? Number(creatureId) : 0
  );

  if (creatureId === null) {
    return null;
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading creature state…</div>;
  }

  if (isError || !state) {
    const handleClaimStarterPack = () => {
      // Placeholder - button does nothing for now
      // TODO: Implement navigation to experiment page
      // if (creatureId) {
      //   navigate(`/experiment?goob=${creatureId.toString()}`);
      // }
    };

    return (
      <div className={styles.notInitializedContainer}>
        {address && creatureId && (
          <button 
            onClick={handleClaimStarterPack}
            className={styles.claimButton}
          >
            Claim Your Starter Pack
          </button>
        )}
      </div>
    );
  }

  const targetTraits = [state.targetSal, state.targetPH, state.targetTemp, state.targetFreq];
  const currentTraits = [state.currSal, state.currPH, state.currTemp, state.currFreq];
  const lockedTraits = [state.lockedSal, state.lockedPH, state.lockedTemp, state.lockedFreq];

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex justify-between items-center">
        <div className="text-xs font-medium text-muted-foreground">Vibes</div>
        <div className="text-sm font-semibold">{state.vibes}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-xs font-medium text-muted-foreground">Locked Traits</div>
        <div className="text-sm font-semibold">{state.lockedCount}</div>
      </div>
      <div className="mt-2 flex flex-col gap-3">
        {targetTraits.map((target, idx) => {
          const current = currentTraits[idx];
          const label = TRAIT_LABELS[idx] ?? `Trait ${idx}`;
          const pct = target === 0 ? 0 : (current * 100) / target;
          const clampedPct = Math.max(0, Math.min(pct, 200));
          const isLocked = lockedTraits[idx];

          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {current} / {target}{' '}
                  {isLocked && (
                    <span className="ml-1 rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      LOCKED
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${clampedPct > 100 ? 100 : clampedPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

