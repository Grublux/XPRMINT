// src/components/stabilization/StabilizationDashboard.tsx

import React, { useState, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';

import { GoobSelector } from './GoobSelector';
import { TraitsPanel } from './TraitsPanel';
import { ItemSelector, type ItemSelectorRef } from './ItemSelector';
import { useWalletSP } from '../../hooks/stabilizationV3/useWalletSP';
import styles from './StabilizationDashboard.module.css';

type Props = {
  isReadOnly?: boolean;
  isSimulating?: boolean;
  isWhitelisted?: boolean;
  onEnableSimulation?: () => void;
};

export const StabilizationDashboard: React.FC<Props> = ({
  isReadOnly: isReadOnlyProp,
  isSimulating: isSimulatingProp = false,
  isWhitelisted = false,
  onEnableSimulation,
}) => {
  const isReadOnly = Boolean(isReadOnlyProp);
  const isSimulating = Boolean(isSimulatingProp);
  
  // TODO: Wire up simulation mode when isSimulating is true
  // For now, the toggle is just a UI element for the deployer
  if (isSimulating) {
    // Simulation mode will be implemented here
  }
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const [selectedGoobId, setSelectedGoobId] = useState<bigint | null>(null);
  const [selectedItemsForGoob, setSelectedItemsForGoob] = useState<Map<number, number>>(new Map());
  const [simulationItems, setSimulationItems] = useState<Map<number, bigint>>(new Map()); // itemId -> balance
  const itemSelectorRef = useRef<ItemSelectorRef>(null);
  
  const { sp, isLoading: spLoading } = useWalletSP();
  
  const handleRestoreItem = (itemId: number) => {
    if (itemSelectorRef.current) {
      itemSelectorRef.current.restoreItem(itemId);
    }
  };

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
          <GoobSelector 
            selectedId={selectedGoobId} 
            onChange={setSelectedGoobId} 
            isReadOnly={isReadOnly}
            isSimulating={isSimulating}
            selectedItemsForGoob={selectedItemsForGoob}
            setSelectedItemsForGoob={setSelectedItemsForGoob}
            onRestoreItem={handleRestoreItem}
            onAddSimulationItems={(count) => {
              // Add 5 random items per Goob sent to lab in simulation mode
              const newItems = new Map(simulationItems);
              for (let i = 0; i < count * 5; i++) {
                const randomItemId = Math.floor(Math.random() * 64); // Items 0-63
                const currentBalance = newItems.get(randomItemId) || 0n;
                newItems.set(randomItemId, currentBalance + 1n);
              }
              setSimulationItems(newItems);
            }}
            isWhitelisted={isWhitelisted}
            onEnableSimulation={onEnableSimulation}
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
          <ItemSelector 
            ref={itemSelectorRef}
            creatureId={selectedGoobId} 
            isSimulating={isSimulating}
            selectedItemsForGoob={selectedItemsForGoob}
            setSelectedItemsForGoob={setSelectedItemsForGoob}
            simulationItems={simulationItems}
            setSimulationItems={setSimulationItems}
            isWhitelisted={isWhitelisted}
          />
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

