// src/components/stabilization/StabilizationDashboard.tsx

import React, { useState } from 'react';
import { useAccount } from 'wagmi';

import { GoobSelector } from './GoobSelector';
import { TraitsPanel } from './TraitsPanel';
import { ItemSelector } from './ItemSelector';
import { useWalletSP } from '../../hooks/stabilizationV3/useWalletSP';
import styles from './StabilizationDashboard.module.css';

export const StabilizationDashboard: React.FC = () => {
  const { address } = useAccount();
  const [selectedGoobId, setSelectedGoobId] = useState<bigint | null>(null);

  if (!address) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-500/40 bg-slate-950/60 p-8 text-center">
        <div className="text-lg font-semibold">Connect your wallet to enter the Lab</div>
        <div className="text-sm text-muted-foreground max-w-md">
          Once connected, we'll detect your Goobs, let you pick a current specimen, and show its
          stabilization state, SP balance, and item inventory.
        </div>
      </div>
    );
  }

  const { sp, isLoading: spLoading } = useWalletSP();

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.dashboardContainer}>
        <div className={styles.headerSection}>
          <h2 className={styles.title}>My Goobs</h2>
        </div>
        <div className={styles.goobInventoryContainer}>
          <div className={styles.goobHint}>Click a Goob to view details</div>
          <GoobSelector selectedId={selectedGoobId} onChange={setSelectedGoobId} />
        </div>
        <div className={styles.traitsSection}>
          <TraitsPanel creatureId={selectedGoobId} />
        </div>
      </div>

      <div className={styles.dashboardContainer}>
        <div className={styles.headerSection}>
          <h2 className={styles.title}>Item Inventory</h2>
        </div>
        <div className={styles.itemInventoryContainer}>
          <ItemSelector />
        </div>
        <div className={styles.spSection}>
          <div className={styles.spLabel}>Stabilization Points (SP)</div>
          <div className={styles.spValue}>
            {spLoading ? '…' : sp.toString()}
          </div>
          <p className={styles.spDescription}>
            Earned by burning items. SP is required to lock traits.
          </p>
        </div>
      </div>
    </div>
  );
};

