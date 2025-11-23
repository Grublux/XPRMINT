// src/components/stabilization/StabilizationDashboard.tsx

import React, { useState } from 'react';
import { useAccount, useConnect } from 'wagmi';

import { GoobSelector } from './GoobSelector';
import { TraitsPanel } from './TraitsPanel';
import { ItemSelector } from './ItemSelector';
import { useWalletSP } from '../../hooks/stabilizationV3/useWalletSP';
import { useSimulatedGoobs } from '../../hooks/goobs/useSimulatedGoobs';
import { useSimulatedItems } from '../../hooks/stabilizationV3/useSimulatedItems';
import styles from './StabilizationDashboard.module.css';

export const StabilizationDashboard: React.FC = () => {
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const [selectedGoobId, setSelectedGoobId] = useState<bigint | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const { goobs: simulatedGoobs, isLoading: loadingSimulatedGoobs } = useSimulatedGoobs();
  const { items: simulatedItems } = useSimulatedItems();

  const handleSimulate = () => {
    setIsSimulating(true);
  };

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  if (!address && !isSimulating) {
    return (
      <div className={styles.dashboardWrapper}>
        <div className={styles.dashboardContainer}>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>My Goobs</h2>
          </div>
          <div className={styles.goobInventoryContainer}>
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="text-lg font-semibold">Connect Wallet or Simulate</div>
              <div className="flex gap-4">
                <button
                  onClick={handleConnect}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                >
                  Connect Wallet
                </button>
                <button
                  onClick={handleSimulate}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  Simulate
                </button>
              </div>
            </div>
          </div>
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
          {isSimulating ? (
            <GoobSelector 
              selectedId={selectedGoobId} 
              onChange={setSelectedGoobId}
              goobs={loadingSimulatedGoobs ? [] : simulatedGoobs}
              isLoading={loadingSimulatedGoobs}
            />
          ) : (
            <GoobSelector selectedId={selectedGoobId} onChange={setSelectedGoobId} />
          )}
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
          {isSimulating ? (
            <ItemSelector items={simulatedItems} />
          ) : (
            <ItemSelector />
          )}
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

