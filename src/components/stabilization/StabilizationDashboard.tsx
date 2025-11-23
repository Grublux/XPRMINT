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
  
  // Always call hooks unconditionally (React rules), but only use results when simulating
  const simulateGoobsQuery = useSimulatedGoobs();
  const simulateItemsQuery = useSimulatedItems();
  
  const simulatedGoobs = isSimulating ? simulateGoobsQuery.goobs : [];
  const loadingSimulatedGoobs = isSimulating ? simulateGoobsQuery.isLoading : false;
  const simulatedItems = isSimulating ? simulateItemsQuery.items : [];

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
            <div className={styles.connectOrSimulateContainer}>
              <div className={styles.connectOrSimulateTitle}>Connect Wallet or Simulate</div>
              <button
                onClick={handleConnect}
                className={styles.connectButton}
              >
                Connect Wallet
              </button>
              <button
                onClick={handleSimulate}
                className={styles.simulateButton}
              >
                Simulate
              </button>
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

