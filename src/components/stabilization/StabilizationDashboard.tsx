// src/components/stabilization/StabilizationDashboard.tsx

import React, { useState } from 'react';
import { useAccount, useConnect } from 'wagmi';

import { GoobSelector } from './GoobSelector';
import { TraitsPanel } from './TraitsPanel';
import { ItemSelector } from './ItemSelector';
import { useWalletSP } from '../../hooks/stabilizationV3/useWalletSP';
import styles from './StabilizationDashboard.module.css';

type Props = {
  isReadOnly?: boolean;
};

export const StabilizationDashboard: React.FC<Props> = ({
  isReadOnly: isReadOnlyProp,
}) => {
  const isReadOnly = Boolean(isReadOnlyProp);
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const [selectedGoobId, setSelectedGoobId] = useState<bigint | null>(null);
  
  const { sp, isLoading: spLoading } = useWalletSP();

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  if (!address) {
    return (
      <div className={styles.dashboardWrapper}>
        <div className={styles.dashboardContainer}>
          <div className={styles.connectOrSimulateContainer}>
            <div className={styles.connectOrSimulateDescription}>
              Connect wallet to import your Goobs and Items into the stabilization lab
            </div>
            <button
              onClick={handleConnect}
              className={styles.connectButton}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.dashboardContainer}>
        <div className={styles.headerSection}>
          <h2 className={styles.title}>My Goobs</h2>
        </div>
        <div className={styles.goobInventoryContainer}>
          <div className={styles.goobHint}>Click a Goob to view details</div>
          <GoobSelector 
            selectedId={selectedGoobId} 
            onChange={setSelectedGoobId} 
            isReadOnly={isReadOnly}
          />
        </div>
        <div className={styles.traitsSection}>
          <TraitsPanel creatureId={selectedGoobId} isReadOnly={isReadOnly} />
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

