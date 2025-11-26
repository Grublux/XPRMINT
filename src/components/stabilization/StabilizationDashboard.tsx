// src/components/stabilization/StabilizationDashboard.tsx

import React, { useState, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';

import { GoobSelector } from './GoobSelector';
import { TraitsPanel } from './TraitsPanel';
import { ItemSelector, type ItemSelectorRef } from './ItemSelector';
import { useWalletSP } from '../../hooks/stabilizationV3/useWalletSP';
import { ITEM_V3_ADDRESS } from '../../config/contracts/stabilizationV3';
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
  
  // Check if this is a page reload - clear simulation items on reload
  const isPageReload = React.useMemo(() => {
    const sessionFlag = sessionStorage.getItem('simulation-items-session');
    if (!sessionFlag) {
      sessionStorage.setItem('simulation-items-session', 'active');
      return true;
    }
    return false;
  }, []);
  
  const [simulationItems, setSimulationItems] = useState<Map<number, bigint>>(() => {
    // Clear on page reload
    if (isPageReload) {
      console.log('[SimulationItems] Page reload detected - clearing items');
      return new Map();
    }
    return new Map(); // Items don't persist across tab switches either
  });
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
              const itemsReceived: Array<{ 
                id: number; 
                name: string; 
                image?: string; 
                image_data?: string;
                quantity: number;
                category?: string;
                magnitude?: number;
                rarity?: string;
              }> = [];
              
              for (let i = 0; i < count * 5; i++) {
                const randomItemId = Math.floor(Math.random() * 64); // Items 0-63
                const currentBalance = newItems.get(randomItemId) || 0n;
                newItems.set(randomItemId, currentBalance + 1n);
                
                // Get item metadata from localStorage cache
                try {
                  const cached = localStorage.getItem(`item-metadata-${ITEM_V3_ADDRESS}-${randomItemId}`);
                  if (cached) {
                    const metadata = JSON.parse(cached);
                    let category: string | undefined;
                    let magnitude: number | undefined;
                    let rarity: string | undefined;
                    
                    // Extract category, magnitude, and rarity from attributes
                    if (metadata?.attributes && Array.isArray(metadata.attributes)) {
                      for (const attr of metadata.attributes) {
                        if (attr.trait_type === 'Rarity') {
                          const rarityValue = String(attr.value).trim();
                          if (rarityValue.toLowerCase() === 'epic') {
                            category = 'Epic';
                          }
                          rarity = rarityValue;
                        } else if (attr.trait_type === 'Primary Trait') {
                          const value = String(attr.value).toLowerCase().trim();
                          if (value.includes('frequency')) category = 'Freq';
                          else if (value.includes('temperature')) category = 'Temp';
                          else if (value.includes('ph') || value === 'ph') category = 'pH';
                          else if (value.includes('salinity')) category = 'Salinity';
                        } else if (attr.trait_type === 'Primary Delta Magnitude') {
                          magnitude = typeof attr.value === 'number' ? Math.abs(attr.value) : Math.abs(parseInt(String(attr.value), 10));
                        }
                      }
                    }
                    
                    itemsReceived.push({
                      id: randomItemId,
                      name: metadata?.name || `Item #${randomItemId}`,
                      image: metadata?.image,
                      image_data: metadata?.image_data,
                      quantity: 1,
                      category,
                      magnitude,
                      rarity,
                    });
                  } else {
                    itemsReceived.push({
                      id: randomItemId,
                      name: `Item #${randomItemId}`,
                      quantity: 1,
                    });
                  }
                } catch {
                  itemsReceived.push({
                    id: randomItemId,
                    name: `Item #${randomItemId}`,
                    quantity: 1,
                  });
                }
              }
              
              setSimulationItems(newItems);
              return itemsReceived;
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

