// src/components/stabilization/GoobSelector.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useUserGoobs } from '../../hooks/goobs/useUserGoobs';
import { useSimulatedGoobs } from '../../hooks/goobs/useSimulatedGoobs';
import { useGoobMetadata } from '../../hooks/goobs/useGoobMetadata';
import { useCreatureState } from '../../hooks/stabilizationV3/useCreatureState';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
import { useQueryClient } from '@tanstack/react-query';
import { ITEM_V3_ADDRESS } from '../../config/contracts/stabilizationV3';
import styles from './GoobSelector.module.css';
import cardStyles from './GoobCard.module.css';

interface GoobSelectorProps {
  selectedId: bigint | null;
  onChange: (id: bigint | null) => void;
  isReadOnly?: boolean;
  isSimulating?: boolean;
  selectedItemsForGoob?: Map<number, number>;
  setSelectedItemsForGoob?: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onRestoreItem?: (itemId: number) => void;
  onAddSimulationItems?: (goobCount: number) => Array<{
    id: number;
    name: string;
    image?: string;
    image_data?: string;
    quantity: number;
    category?: string;
    magnitude?: number;
    rarity?: string;
  }> | void;
  isWhitelisted?: boolean;
  onEnableSimulation?: () => void;
}

type LabFilter = 'Waiting Room' | 'Lab';

// Helper function to generate initialization values for a Goob
function generateInitialization(_goobId: bigint): {
  targetFreq: number;
  targetTemp: number;
  targetPH: number;
  targetSal: number;
  currFreq: number;
  currTemp: number;
  currPH: number;
  currSal: number;
  vibes: number;
  lockedFreq: boolean;
  lockedTemp: boolean;
  lockedPH: boolean;
  lockedSal: boolean;
  lockedCount: number;
} {
  const TARGET_MIN = 20;
  const TARGET_MAX = 80;
  const LOCK_PCT = 0.05; // 5%
  const OFFSET_MAX_PCT = 0.30; // 30%
  
  // Generate random targets
  const targetFreq = Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)) + TARGET_MIN;
  const targetTemp = Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)) + TARGET_MIN;
  const targetPH = Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)) + TARGET_MIN;
  const targetSal = Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)) + TARGET_MIN;
  
  // Generate initial current values with 5-30% offset from target
  const generateCurrent = (target: number): number => {
    // Random offset between -30% and +30%
    let offsetFactor = (Math.random() * 2 - 1) * OFFSET_MAX_PCT;
    
    // Clamp to at least 5% away (never start in lock band)
    if (Math.abs(offsetFactor) < LOCK_PCT) {
      offsetFactor = offsetFactor >= 0 ? LOCK_PCT : -LOCK_PCT;
    }
    
    const raw = target * (1 + offsetFactor);
    // Clamp to reasonable range (0-100)
    return Math.max(0, Math.min(100, Math.round(raw)));
  };
  
  return {
    targetFreq,
    targetTemp,
    targetPH,
    targetSal,
    currFreq: generateCurrent(targetFreq),
    currTemp: generateCurrent(targetTemp),
    currPH: generateCurrent(targetPH),
    currSal: generateCurrent(targetSal),
    vibes: 9, // Always start at 9
    lockedFreq: false,
    lockedTemp: false,
    lockedPH: false,
    lockedSal: false,
    lockedCount: 0,
  };
}

// Helper to get/set simulated creature state from localStorage
function getSimulatedCreatureState(goobId: bigint): any | null {
  try {
    const key = `simulated-creature-state-${goobId.toString()}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('[SimulatedCreatureState] Failed to load:', err);
  }
  return null;
}

function setSimulatedCreatureState(goobId: bigint, state: any): void {
  try {
    const key = `simulated-creature-state-${goobId.toString()}`;
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.error('[SimulatedCreatureState] Failed to save:', err);
  }
}

export const GoobSelector: React.FC<GoobSelectorProps> = ({ 
  selectedId, 
  onChange,
  isSimulating = false,
  selectedItemsForGoob = new Map(),
  setSelectedItemsForGoob,
  onRestoreItem,
  onAddSimulationItems,
  isWhitelisted = false,
  onEnableSimulation,
}) => {
  const { address } = useAccount();
  const { goobs: walletGoobs, isLoading: walletIsLoading, isError, error, progress } = useUserGoobs();
  const { goobs: simulatedGoobs, isLoading: simulatedIsLoading } = useSimulatedGoobs();
  
  // For whitelisted wallets during early testing: only use simulation mode
  // Don't load real Goobs/items when whitelisted and not simulating
  const shouldUseSimulation = isWhitelisted && !isSimulating;
  
  // Use simulated Goobs when simulation is on, otherwise use wallet Goobs (unless whitelisted)
  const goobs = isSimulating ? simulatedGoobs : (shouldUseSimulation ? [] : walletGoobs);
  const isLoading = isSimulating ? simulatedIsLoading : (shouldUseSimulation ? false : walletIsLoading);
  const [expandedGoobId, setExpandedGoobId] = useState<bigint | null>(null);
  const [labFilter, setLabFilter] = useState<LabFilter>('Waiting Room');
  
  // Get localStorage key scoped to address and simulation mode
  const storageKey = React.useMemo(() => {
    const mode = isSimulating ? 'simulation' : (address ? address.toLowerCase() : 'default');
    return `goobs-in-lab-${mode}`;
  }, [address, isSimulating]);
  
  // Check if this is a page reload (not a tab switch)
  // Use Navigation Timing API to detect reloads
  const isPageReload = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const navType = navEntries[0].type;
        // 'reload' means page was reloaded, 'navigate' means fresh navigation
        // We want to clear on both reload and fresh navigation
        return navType === 'reload' || navType === 'navigate';
      }
      
      // Fallback for older browsers
      const perfNav = (performance as any).navigation;
      if (perfNav) {
        return perfNav.type === 1; // TYPE_RELOAD
      }
    } catch (err) {
      console.error('[GoobsInLab] Failed to detect navigation type:', err);
    }
    
    // Default to treating as reload to be safe
    return true;
  }, []);

  // Initialize goobsInLab from localStorage for persistence
  // Clear on page reload, persist on tab switches
  const [goobsInLab, setGoobsInLab] = useState<Set<string>>(() => {
    // If this is a page reload, clear everything
    if (isPageReload) {
      console.log('[GoobsInLab] Page reload detected - clearing lab');
      try {
        // Clear all possible storage keys
        localStorage.removeItem('goobs-in-lab-simulation');
        localStorage.removeItem('goobs-in-lab-default');
        const addressStored = localStorage.getItem('lastConnectedAddress');
        if (addressStored) {
          localStorage.removeItem(`goobs-in-lab-${addressStored.toLowerCase()}`);
        }
        
        // Clear all simulated creature states
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('simulated-creature-state-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('[GoobsInLab] Cleared simulated creature states:', keysToRemove.length);
      } catch (error) {
        console.error('[GoobsInLab] Failed to clear on reload', error);
      }
      return new Set();
    }

    // Tab switch - try to load from localStorage
    try {
      // Get isSimulating from localStorage
      let isSim = false;
      try {
        const simStored = localStorage.getItem('isSimulationOn');
        if (simStored !== null) {
          isSim = simStored === 'true';
        }
      } catch {}
      
      // Try simulation key first
      if (isSim) {
        const key = 'goobs-in-lab-simulation';
        const stored = localStorage.getItem(key);
        if (stored) {
          const ids = JSON.parse(stored) as string[];
          console.log('[GoobsInLab] Initialized from localStorage (simulation):', ids);
          return new Set(ids);
        }
      }
      
      // Try address-based key (get from localStorage if available)
      try {
        const addressStored = localStorage.getItem('lastConnectedAddress');
        if (addressStored) {
          const key = `goobs-in-lab-${addressStored.toLowerCase()}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const ids = JSON.parse(stored) as string[];
            console.log('[GoobsInLab] Initialized from localStorage (address):', ids);
            return new Set(ids);
          }
        }
      } catch {}
      
      // Try default key as fallback
      const defaultKey = 'goobs-in-lab-default';
      const stored = localStorage.getItem(defaultKey);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        console.log('[GoobsInLab] Initialized from localStorage (default):', ids);
        return new Set(ids);
      }
    } catch (error) {
      console.error('[GoobsInLab] Failed to initialize from localStorage', error);
    }
    return new Set();
  });
  
  // Save current address to localStorage for recovery
  useEffect(() => {
    if (address) {
      try {
        localStorage.setItem('lastConnectedAddress', address);
      } catch {}
    }
  }, [address]);
  
  // Track previous storage key to detect changes
  const prevStorageKeyRef = useRef<string>(storageKey);
  
  // Re-initialize from localStorage ONLY when storageKey actually changes
  useEffect(() => {
    // Only run if storageKey actually changed (not on initial mount)
    if (prevStorageKeyRef.current === storageKey) {
      return;
    }
    
    prevStorageKeyRef.current = storageKey;
    
    try {
      const stored = localStorage.getItem(storageKey);
      console.log('[GoobsInLab] Storage key changed, loading:', storageKey, 'stored:', stored);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        console.log('[GoobsInLab] Setting state from storage:', ids);
        setGoobsInLab(new Set(ids));
      } else {
        // Don't clear - try to find data in other keys first
        console.log('[GoobsInLab] No stored data for key:', storageKey, 'searching alternatives...');
        
        // Try to find data in alternative keys
        const altKeys = [
          'goobs-in-lab-simulation',
          address ? `goobs-in-lab-${address.toLowerCase()}` : null,
          'goobs-in-lab-default'
        ].filter(Boolean) as string[];
        
        for (const key of altKeys) {
          if (key === storageKey) continue;
          const altStored = localStorage.getItem(key);
          if (altStored) {
            const ids = JSON.parse(altStored) as string[];
            if (ids.length > 0) {
              console.log('[GoobsInLab] Found data in alternative key:', key, ids);
              setGoobsInLab(new Set(ids));
              // Migrate to correct key
              localStorage.setItem(storageKey, altStored);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('[GoobsInLab] Failed to load from localStorage', error);
    }
  }, [storageKey, address]);
  
  // Persist goobsInLab to localStorage whenever it changes
  // Only save if goobsInLab actually has items (don't save empty arrays)
  useEffect(() => {
    // Skip saving if goobsInLab is empty - this prevents overwriting with empty data
    if (goobsInLab.size === 0) {
      console.log('[GoobsInLab] Skipping save - goobsInLab is empty');
      return;
    }
    
    try {
      const ids = Array.from(goobsInLab);
      console.log('[GoobsInLab] Saving to localStorage:', storageKey, ids);
      localStorage.setItem(storageKey, JSON.stringify(ids));
    } catch (error) {
      console.error('[GoobsInLab] Failed to save to localStorage', error);
    }
  }, [goobsInLab, storageKey]);
  
  // When storageKey changes, migrate existing data to new key BEFORE saving
  const prevStorageKeyRef2 = useRef<string>(storageKey);
  useEffect(() => {
    if (prevStorageKeyRef2.current === storageKey) return;
    
    const oldKey = prevStorageKeyRef2.current;
    prevStorageKeyRef2.current = storageKey;
    
    // If we have data in state, save it to the new key
    if (goobsInLab.size > 0) {
      try {
        const ids = Array.from(goobsInLab);
        console.log('[GoobsInLab] Migrating data to new key:', oldKey, '->', storageKey, ids);
        localStorage.setItem(storageKey, JSON.stringify(ids));
        // Keep old key as backup
      } catch (error) {
        console.error('[GoobsInLab] Failed to migrate to new key', error);
      }
    }
  }, [storageKey, goobsInLab]);
  const [goobsSelectedForBatch, setGoobsSelectedForBatch] = useState<Set<string>>(new Set());
  const [hasNewLabActivity, setHasNewLabActivity] = useState(false);
  const previousLabCountRef = useRef<number>(0);
  const [showFakeTransactionModal, setShowFakeTransactionModal] = useState(false);
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showReceivedItemsModal, setShowReceivedItemsModal] = useState(false);
  const [receivedItems, setReceivedItems] = useState<Array<{ 
    id: number; 
    name: string; 
    image?: string; 
    image_data?: string;
    quantity: number;
    category?: string;
    magnitude?: number;
    rarity?: string;
  }>>([]);
  const [sentGoobIds, setSentGoobIds] = useState<bigint[]>([]);
  const [pendingGoobIds, setPendingGoobIds] = useState<bigint[]>([]);

  // Count Goobs in each category (calculate before early returns for useEffect)
  const labCount = goobs.filter((g: { tokenId: bigint }) => {
    const idStr = g.tokenId.toString();
    return goobsInLab.has(idStr);
  }).length;

  // Detect when new goobs are added to lab (must be before any conditional returns)
  useEffect(() => {
    if (labCount > previousLabCountRef.current) {
      // New goob(s) added to lab
      setHasNewLabActivity(true);
    }
    previousLabCountRef.current = labCount;
  }, [labCount]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">Scanning For Goobs</div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-red-400">
        Unable to load Goobs: {error?.message || 'Unknown error'}. Check console for details.
      </div>
    );
  }

  // Show "Web3 disabled" message for whitelisted wallets when not simulating
  if (shouldUseSimulation) {
    return (
      <div className={styles.noGoobsContainer}>
        <div className={styles.noGoobsTitle}>Web3 disabled</div>
        <button
          onClick={() => {
            if (onEnableSimulation) {
              onEnableSimulation();
            }
          }}
          className={styles.simulateButton}
        >
          Click to simulate
        </button>
      </div>
    );
  }

  if (!goobs.length) {
    return (
      <div className={styles.noGoobsContainer}>
        <div className={styles.noGoobsTitle}>You Have No Goobs</div>
        <div className={styles.noGoobsMessage}>
          Head to{' '}
          <a 
            href="https://thegoblinn.com/protogoobs" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.noGoobsLink}
          >
            thegoblinn.com/protogoobs
          </a>
          {' '}to mint your Goob now!
        </div>
      </div>
    );
  }

  const handleSelectForBatch = (tokenId: bigint, e: React.MouseEvent) => {
    e.stopPropagation();
    const idStr = tokenId.toString();
    setGoobsSelectedForBatch(prev => {
      const next = new Set(prev);
      if (next.has(idStr)) {
        next.delete(idStr);
      } else {
        next.add(idStr);
      }
      return next;
    });
  };

  const filteredGoobs = goobs.filter((g: { tokenId: bigint }) => {
    const idStr = g.tokenId.toString();
    const inLab = goobsInLab.has(idStr);
    return labFilter === 'Lab' ? inLab : !inLab;
  });

  const selectedForLabCount = goobsSelectedForBatch.size;
  
  // Count Goobs in waiting room
  const waitingRoomCount = goobs.filter((g: { tokenId: bigint }) => {
    const idStr = g.tokenId.toString();
    return !goobsInLab.has(idStr);
  }).length;

  const handleBatchSendToLab = () => {
    const selectedGoobIds = Array.from(goobsSelectedForBatch).map(id => BigInt(id));
    
    if (selectedGoobIds.length === 0) {
      console.log('[Batch Send] No Goobs selected');
      return;
    }

    // Store pending Goob IDs and show fake transaction modal
    setPendingGoobIds(selectedGoobIds);
    setShowFakeTransactionModal(true);
  };

  const handleFakeTransactionSign = () => {
    const selectedGoobIds = pendingGoobIds;
    
    console.log('[Batch Send] Fake transaction signed, sending to lab:', selectedGoobIds.map(id => id.toString()));
    
    // Close fake transaction modal and show loading
    setShowFakeTransactionModal(false);
    setIsProcessingTransaction(true);
    
    // After 1 second delay, process transaction and show confetti
    setTimeout(() => {
      // Initialize simulated creature state for each Goob sent to lab
      if (isSimulating) {
        selectedGoobIds.forEach(goobId => {
          const existing = getSimulatedCreatureState(goobId);
          if (!existing) {
            // Only initialize if not already initialized
            const initState = generateInitialization(goobId);
            setSimulatedCreatureState(goobId, initState);
            console.log('[SimulatedCreatureState] Initialized Goob:', goobId.toString(), initState);
          } else {
            console.log('[SimulatedCreatureState] Goob already initialized:', goobId.toString());
          }
        });
      }
      
      // Move selected Goobs to "In Lab" and clear selection
      setGoobsInLab(prev => {
        const next = new Set(prev);
        selectedGoobIds.forEach(id => {
          const idStr = id.toString();
          if (!next.has(idStr)) {
            next.add(idStr);
            console.log('[GoobsInLab] Adding Goob to lab:', idStr);
          } else {
            console.warn('[GoobsInLab] Goob already in lab, skipping:', idStr);
          }
        });
        console.log('[GoobsInLab] Total Goobs in lab after add:', Array.from(next));
        return next;
      });
      
      // Show confetti effect
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000); // Hide confetti after 2 seconds
      
      // In simulation mode, track received items and show received items modal
      if (isSimulating && onAddSimulationItems) {
        // Store the Goob IDs that were sent
        setSentGoobIds(selectedGoobIds);
        
        // Call the callback to add items to inventory and get the actual items received
        const result = onAddSimulationItems(selectedGoobIds.length);
        // Use items from callback if provided (result should be array with quantity property)
        if (Array.isArray(result) && result.length > 0) {
          // Ensure all items have the required properties with correct types
          const itemsWithQuantity: Array<{
            id: number;
            name: string;
            image?: string;
            image_data?: string;
            quantity: number;
            category?: string;
            magnitude?: number;
            rarity?: string;
          }> = result.map(item => ({
            id: item.id,
            name: item.name,
            image: 'image' in item ? item.image : undefined,
            image_data: 'image_data' in item ? item.image_data : undefined,
            quantity: 'quantity' in item && typeof item.quantity === 'number' ? item.quantity : 1,
            category: 'category' in item ? item.category : undefined,
            magnitude: 'magnitude' in item ? item.magnitude : undefined,
            rarity: 'rarity' in item ? item.rarity : undefined,
          }));
          setReceivedItems(itemsWithQuantity);
          setIsProcessingTransaction(false);
          setShowReceivedItemsModal(true);
        } else {
          setIsProcessingTransaction(false);
        }
      } else {
        setIsProcessingTransaction(false);
      }
      
      setGoobsSelectedForBatch(new Set());
      setPendingGoobIds([]);
    }, 1000);
  };

  return (
    <div style={{ paddingTop: '20px', width: '100%' }}>
      {/* Filter Buttons - hidden when Goob is expanded */}
      {!expandedGoobId && (
        <>
          <div className={styles.filterContainer}>
            <button
              className={`${styles.filterButton} ${labFilter === 'Waiting Room' ? styles.filterButtonActive : ''}`}
              onClick={() => {
                setLabFilter('Waiting Room');
                setExpandedGoobId(null);
                onChange(null); // Clear selection when switching tabs
              }}
            >
              Waiting Room
            </button>
            <button
              className={`${styles.filterButton} ${labFilter === 'Lab' ? styles.filterButtonActive : ''} ${hasNewLabActivity && labFilter !== 'Lab' ? styles.filterButtonPulse : ''}`}
              onClick={() => {
                setLabFilter('Lab');
                setExpandedGoobId(null);
                onChange(null); // Clear selection when switching tabs
                setHasNewLabActivity(false); // Stop pulsing when Lab tab is clicked
              }}
            >
              Lab
            </button>
          </div>
          
          {/* Count readout */}
          <div className={styles.goobCountReadout}>
            Waiting Room: {waitingRoomCount} | Lab: {labCount}
          </div>
        </>
      )}
      
      {/* Title - "Goobs ####" when expanded */}
      {expandedGoobId && labFilter === 'Lab' && (
        <div className={styles.expandedTitle}>
          Goobs #{expandedGoobId.toString()}
        </div>
      )}

      {/* Hint Text - hidden when Goob is expanded */}
      {!expandedGoobId && labFilter === 'Waiting Room' && (
        <div className={styles.goobHint}>
          Click Goobs to send to lab
        </div>
      )}

      {!expandedGoobId && labFilter === 'Lab' && (
        <div className={styles.goobHint}>
          Click a Goob to expand
        </div>
      )}

      {/* Batch Send Button */}
      {selectedForLabCount > 0 && labFilter === 'Waiting Room' && (
        <div className={styles.batchSendContainer}>
          <button
            className={styles.batchSendButton}
            onClick={handleBatchSendToLab}
          >
            Send <span className={styles.batchNumber}>{selectedForLabCount}</span> {selectedForLabCount === 1 ? 'Goob' : 'Goobs'} TO LAB
          </button>
          <div className={styles.batchSendText}>
            And receive <span className={styles.batchNumber}>{selectedForLabCount * 5}</span> starter items
          </div>
        </div>
      )}

      {filteredGoobs.length === 0 && labFilter === 'Lab' ? (
        <div className={styles.noGoobsContainer}>
          <div className={styles.noGoobsTitle}>You have no Goobs in the lab</div>
        </div>
      ) : expandedGoobId && labFilter === 'Lab' ? (
        <ExpandedGoobView
          tokenId={expandedGoobId}
          onClose={() => setExpandedGoobId(null)}
          selectedItemsForGoob={selectedItemsForGoob}
          setSelectedItemsForGoob={setSelectedItemsForGoob}
          onRestoreItem={onRestoreItem}
          isSimulating={isSimulating}
        />
      ) : (
        <div className={styles.goobGrid}>
          {filteredGoobs.map((g: { tokenId: bigint }) => {
            const isSelected = selectedId === g.tokenId;
            const isSelectedForBatch = goobsSelectedForBatch.has(g.tokenId.toString());
            return (
              <GoobCard
                key={g.tokenId.toString()}
                tokenId={g.tokenId}
                isSelected={isSelected}
                isSelectedForBatch={isSelectedForBatch}
                showPlusButton={labFilter === 'Waiting Room'}
                isWaitingRoom={labFilter === 'Waiting Room'}
                onSelect={() => {
                  if (labFilter === 'Lab') {
                    // In Lab: expand the Goob and set selectedId so ItemSelector knows
                    setExpandedGoobId(g.tokenId);
                    onChange(g.tokenId);
                  }
                }}
                onSelectForBatch={(e) => handleSelectForBatch(g.tokenId, e)}
              />
            );
          })}
        </div>
      )}
      
      {/* Processing Transaction Loading */}
      {isProcessingTransaction && (
        <div className={styles.processingOverlay}>
          <div className={styles.spinner}></div>
        </div>
      )}
      
      {/* Confetti Effect */}
      {showConfetti && <ConfettiEffect />}
      
      {/* Fake Transaction Modal */}
      {showFakeTransactionModal && (
        <FakeTransactionModal
          goobCount={pendingGoobIds.length}
          onSign={handleFakeTransactionSign}
          onClose={() => {
            setShowFakeTransactionModal(false);
            setPendingGoobIds([]);
          }}
        />
      )}
      
      {/* Received Items Modal */}
      {showReceivedItemsModal && (
        <ReceivedItemsModal
          items={receivedItems}
          sentGoobIds={sentGoobIds}
          onClose={() => setShowReceivedItemsModal(false)}
          onGoToLab={() => {
            setLabFilter('Lab');
            setShowReceivedItemsModal(false);
            setExpandedGoobId(null);
            onChange(null);
          }}
        />
      )}
    </div>
  );
};

// Fake Transaction Modal Component
const FakeTransactionModal: React.FC<{
  goobCount: number;
  onSign: () => void;
  onClose: () => void;
}> = ({ goobCount, onSign, onClose }) => {
  return (
    <div 
      className={styles.fakeTransactionOverlay}
      onClick={onClose}
    >
      <div 
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className={styles.fakeTransactionText}>
          Approve and Send {goobCount} {goobCount === 1 ? 'Goob' : 'Goobs'} to Lab
        </div>
        <button 
          className={styles.fakeTransactionButton}
          onClick={onSign}
        >
          Sign Fake Transaction
        </button>
      </div>
    </div>
  );
};

// Confetti Effect Component
const ConfettiEffect: React.FC = () => {
  const confettiRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!confettiRef.current) return;
    
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = styles.confettiPiece;
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      confettiRef.current.appendChild(confetti);
    }
    
    return () => {
      if (confettiRef.current) {
        confettiRef.current.innerHTML = '';
      }
    };
  }, []);
  
  return <div ref={confettiRef} className={styles.confettiContainer} />;
};

// Received Items Modal Component

// Received Items Modal Component
const ReceivedItemsModal: React.FC<{
  items: Array<{ 
    id: number; 
    name: string; 
    image?: string; 
    image_data?: string;
    quantity: number;
    category?: string;
    magnitude?: number;
    rarity?: string;
  }>;
  sentGoobIds: bigint[];
  onClose: () => void;
  onGoToLab: () => void;
}> = ({ items, sentGoobIds, onClose, onGoToLab }) => {
  // Group items by ID to show quantities
  const groupedItems = React.useMemo(() => {
    const grouped = new Map<number, typeof items[0] & { quantity: number }>();
    items.forEach(item => {
      const existing = grouped.get(item.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        grouped.set(item.id, { ...item, quantity: item.quantity });
      }
    });
    return Array.from(grouped.values());
  }, [items]);

  // Calculate total item count
  const totalItemCount = React.useMemo(() => {
    return groupedItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [groupedItems]);

  return (
    <div 
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div 
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {sentGoobIds.length > 0 && (
          <div className={styles.modalGoobIds}>
            Goob{sentGoobIds.length === 1 ? '' : 's'} {sentGoobIds.map(id => `#${id.toString()}`).join(', ')} sent to the lab
          </div>
        )}
        <h2 className={styles.modalTitle}>You received {totalItemCount} items:</h2>
        <div className={styles.modalItemsList}>
          {groupedItems.map((item) => (
            <div key={item.id} className={styles.modalItem}>
              <div className={styles.modalItemImage}>
                <img 
                  src={item.image || item.image_data || ''} 
                  alt={item.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className={styles.modalItemInfo}>
                <div className={styles.modalItemName}>{item.name}</div>
                <div className={styles.modalItemDetails}>
                  {item.rarity && (
                    <span className={styles.modalItemRarity}>Rarity: {item.rarity}</span>
                  )}
                  {item.category && (
                    <span className={styles.modalItemCategory}>
                      {item.category}
                      {item.magnitude !== undefined && ` ${item.magnitude}`}
                    </span>
                  )}
                  <span className={styles.modalItemQuantity}>+{item.quantity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button 
          className={styles.modalGoToLabButton}
          onClick={onGoToLab}
        >
          Go to Lab
        </button>
      </div>
    </div>
  );
};

// Burning Item Thumbnail Component (for modal)
const BurningItemThumbnail: React.FC<{
  itemId: number;
  count: number;
}> = ({ itemId, count }) => {
  const { metadata, isLoading } = useItemMetadata(itemId);
  const imageUrl = metadata?.image || metadata?.image_data || null;
  
  return (
    <div style={{
      position: 'relative',
      width: '60px',
      height: '60px',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid rgba(239, 68, 68, 0.5)',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Minus sign overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
        zIndex: 2,
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#ef4444',
      }}>
        −
      </div>
      {/* Item image */}
      {isLoading ? (
        <div style={{ fontSize: '8px', color: 'var(--muted)' }}>Loading...</div>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={metadata?.name || `Item #${itemId}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: 0.6,
          }}
        />
      ) : (
        <div style={{ fontSize: '8px', color: 'var(--muted)' }}>No image</div>
      )}
      {/* Count badge */}
      {count > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '2px',
          right: '2px',
          fontSize: '10px',
          fontWeight: 600,
          color: '#ef4444',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '2px 4px',
          borderRadius: '2px',
          zIndex: 3,
        }}>
          x{count}
        </div>
      )}
    </div>
  );
};

// Apply Changes Modal Component
const ApplyChangesModal: React.FC<{
  itemCount: number;
  changes: { freq: number; temp: number; ph: number; salinity: number };
  currentState: { freq: number; temp: number; ph: number; salinity: number };
  targetState: { freq: number; temp: number; ph: number; salinity: number };
  selectedItems: Map<number, number>;
  onApply: () => void;
  onClose: () => void;
}> = ({ itemCount, changes, currentState, targetState, selectedItems, onApply, onClose }) => {
  // Helper to determine if change moves closer to target
  const isCloserToTarget = (change: number, current: number, target: number): boolean => {
    if (change === 0) return true;
    const currentDistance = Math.abs(current - target);
    const newState = current + change;
    const newDistance = Math.abs(newState - target);
    return newDistance <= currentDistance;
  };
  
  const getChangeColor = (change: number, trait: 'freq' | 'temp' | 'ph' | 'salinity'): string => {
    const current = trait === 'freq' ? currentState.freq : trait === 'temp' ? currentState.temp : trait === 'ph' ? currentState.ph : currentState.salinity;
    const target = trait === 'freq' ? targetState.freq : trait === 'temp' ? targetState.temp : trait === 'ph' ? targetState.ph : targetState.salinity;
    return isCloserToTarget(change, current, target) ? '#10b981' : '#ef4444';
  };
  return (
    <div 
      className={styles.fakeTransactionOverlay}
      onClick={onClose}
    >
      <div 
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className={styles.fakeTransactionText} style={{ marginBottom: '24px' }}>
          Burn {itemCount} {itemCount === 1 ? 'item' : 'items'} and apply Changes?
        </div>
        
        {/* Items being burned */}
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}>
          {Array.from(selectedItems.entries()).map(([itemId, count]) => (
            <BurningItemThumbnail key={itemId} itemId={itemId} count={count} />
          ))}
        </div>
        
        {/* Changes Table */}
        <div style={{
          width: '100%',
          marginBottom: '24px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '12px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '8px',
            marginBottom: '8px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>Freq</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>Temp</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>pH</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>Salinity</div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '8px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: getChangeColor(changes.freq, 'freq'), textAlign: 'center' }}>
              {changes.freq > 0 ? '+' : ''}{changes.freq}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: getChangeColor(changes.temp, 'temp'), textAlign: 'center' }}>
              {changes.temp > 0 ? '+' : ''}{changes.temp}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: getChangeColor(changes.ph, 'ph'), textAlign: 'center' }}>
              {changes.ph > 0 ? '+' : ''}{changes.ph}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: getChangeColor(changes.salinity, 'salinity'), textAlign: 'center' }}>
              {changes.salinity > 0 ? '+' : ''}{changes.salinity}
            </div>
          </div>
        </div>
        
        <button 
          className={styles.fakeTransactionButton}
          onClick={onApply}
        >
          Burn Items and Apply
        </button>
      </div>
    </div>
  );
};

// Apply Success Modal Component
const ApplySuccessModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  return (
    <div 
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div 
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className={styles.modalCloseButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className={styles.modalTitle} style={{ marginBottom: '24px' }}>
          Changes Applied Successfully
        </h2>
        <button 
          className={styles.modalGoToLabButton}
          onClick={onClose}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

// Expanded Goob view component
const ExpandedGoobView: React.FC<{
  tokenId: bigint;
  onClose: () => void;
  selectedItemsForGoob?: Map<number, number>;
  setSelectedItemsForGoob?: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onRestoreItem?: (itemId: number) => void;
  isSimulating?: boolean;
}> = ({ tokenId, onClose, selectedItemsForGoob = new Map(), setSelectedItemsForGoob, onRestoreItem, isSimulating = false }) => {
  const { metadata, isLoading } = useGoobMetadata(tokenId);
  const { state: creatureState } = useCreatureState(Number(tokenId));
  const imageUrl = metadata?.image_data || metadata?.image || null;
  const queryClient = useQueryClient();
  
  // State for apply changes flow (declared early to avoid initialization errors)
  const [refreshKey, setRefreshKey] = React.useState(0);
  
  // Track scroll position when first item is added to prevent focus jump
  const goobItemAreaRef = React.useRef<HTMLDivElement | null>(null);
  const previousItemCountRef = React.useRef(selectedItemsForGoob.size);
  
  React.useEffect(() => {
    // Check if we just added the first item (went from 0 to 1)
    const currentCount = selectedItemsForGoob.size;
    const previousCount = previousItemCountRef.current;
    
    if (previousCount === 0 && currentCount === 1 && goobItemAreaRef.current) {
      // Store the current position of the Goob Item Area before expansion
      const goobItemAreaElement = goobItemAreaRef.current;
      const rectBefore = goobItemAreaElement.getBoundingClientRect();
      
      // Use requestAnimationFrame to wait for DOM update, then adjust scroll
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const rectAfter = goobItemAreaElement.getBoundingClientRect();
          const heightDifference = rectAfter.height - rectBefore.height;
          
          // If the area expanded, scroll down by that amount to keep item inventory in same relative position
          if (heightDifference > 0) {
            window.scrollBy({
              top: heightDifference,
              behavior: 'instant' as ScrollBehavior
            });
          }
        });
      });
    }
    
    previousItemCountRef.current = currentCount;
  }, [selectedItemsForGoob.size]);
  
  // Get simulated state if in simulation mode
  const simulatedState = React.useMemo(() => {
    if (isSimulating) {
      return getSimulatedCreatureState(tokenId);
    }
    return null;
  }, [isSimulating, tokenId, refreshKey]);
  
  // Use simulated state if available, otherwise use on-chain state
  const displayState = simulatedState || creatureState;
  
  // Check if any selected item is Epic and get the Epic item ID
  const epicItemInfo = React.useMemo(() => {
    if (!selectedItemsForGoob || selectedItemsForGoob.size === 0) return { hasEpic: false, itemId: null };
    for (const [itemId] of selectedItemsForGoob.entries()) {
      try {
        const queryKey = ['item-metadata', ITEM_V3_ADDRESS, itemId.toString()];
        const cachedData = queryClient.getQueryData(queryKey);
        if (cachedData) {
          const metadata = cachedData as any;
          if (metadata?.attributes) {
            for (const attr of metadata.attributes) {
              if (attr.trait_type === 'Rarity' && String(attr.value).toLowerCase().trim() === 'epic') {
                return { hasEpic: true, itemId };
              }
            }
          }
        }
      } catch (e) {
        // Try localStorage
        try {
          const key = `item-metadata-${ITEM_V3_ADDRESS}-${itemId}`;
          const cached = localStorage.getItem(key);
          if (cached) {
            const metadata = JSON.parse(cached);
            if (metadata?.attributes) {
              for (const attr of metadata.attributes) {
                if (attr.trait_type === 'Rarity' && String(attr.value).toLowerCase().trim() === 'epic') {
                  return { hasEpic: true, itemId };
                }
              }
            }
          }
        } catch (e2) {
          // Ignore
        }
      }
    }
    return { hasEpic: false, itemId: null };
  }, [selectedItemsForGoob, queryClient]);
  
  const hasEpicItem = epicItemInfo.hasEpic;
  
  // Calculate worst trait for Epic item (based on original state)
  const worstTraitForEpic = React.useMemo(() => {
    if (!hasEpicItem || !displayState) return null;
    const traits = [
      { name: 'Freq', current: displayState.currFreq, target: displayState.targetFreq, locked: displayState.lockedFreq || false },
      { name: 'Temp', current: displayState.currTemp, target: displayState.targetTemp, locked: displayState.lockedTemp || false },
      { name: 'pH', current: displayState.currPH, target: displayState.targetPH, locked: displayState.lockedPH || false },
      { name: 'Salinity', current: displayState.currSal, target: displayState.targetSal, locked: displayState.lockedSal || false },
    ];
    
    let worstTrait = null;
    let worstError = -1;
    for (const trait of traits) {
      if (trait.locked) continue;
      const error = trait.target === 0 ? Math.abs(trait.current) : Math.abs((trait.current - trait.target) / trait.target);
      if (error > worstError) {
        worstError = error;
        worstTrait = trait.name;
      }
    }
    return worstTrait;
  }, [hasEpicItem, displayState]);
  
  // State for Epic trait selection (defaults to worst trait)
  const [selectedEpicTrait, setSelectedEpicTrait] = React.useState<'Freq' | 'Temp' | 'pH' | 'Salinity' | null>(null);
  
  // Update selectedEpicTrait when worstTraitForEpic changes
  React.useEffect(() => {
    if (worstTraitForEpic && (!selectedEpicTrait || !hasEpicItem)) {
      setSelectedEpicTrait(worstTraitForEpic as 'Freq' | 'Temp' | 'pH' | 'Salinity');
    }
    if (!hasEpicItem) {
      setSelectedEpicTrait(null);
    }
  }, [worstTraitForEpic, hasEpicItem, selectedEpicTrait]);
  
  const isInitialized = displayState !== null && 
    !(displayState.targetSal === 0 && displayState.targetPH === 0 && 
      displayState.targetTemp === 0 && displayState.targetFreq === 0);
  
  // State for apply changes flow
  const [showApplyChangesModal, setShowApplyChangesModal] = React.useState(false);
  const [isProcessingApply, setIsProcessingApply] = React.useState(false);
  const [showApplySuccessModal, setShowApplySuccessModal] = React.useState(false);
  
  // Helper to get item metadata from cache
  const getItemMetadata = React.useCallback((itemId: number): any => {
    // Try React Query cache first
    try {
      const queryKey = ['item-metadata', ITEM_V3_ADDRESS, itemId.toString()];
      const cachedData = queryClient.getQueryData(queryKey);
      if (cachedData) {
        return cachedData;
      }
    } catch (e) {
      // Query cache access failed
    }
    
    // Try localStorage
    try {
      const key = `item-metadata-${ITEM_V3_ADDRESS}-${itemId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // localStorage access failed
    }
    
    return null;
  }, [queryClient]);
  
  // Calculate preview state by applying items
  const previewState = React.useMemo(() => {
    if (!isInitialized || !displayState || selectedItemsForGoob.size === 0) {
      return null;
    }
    
    // Start with current state
    let preview = {
      currFreq: displayState.currFreq,
      currTemp: displayState.currTemp,
      currPH: displayState.currPH,
      currSal: displayState.currSal,
      targetFreq: displayState.targetFreq,
      targetTemp: displayState.targetTemp,
      targetPH: displayState.targetPH,
      targetSal: displayState.targetSal,
      lockedFreq: displayState.lockedFreq || false,
      lockedTemp: displayState.lockedTemp || false,
      lockedPH: displayState.lockedPH || false,
      lockedSal: displayState.lockedSal || false,
    };
    
    // Helper functions to get original state (before any items applied)
    const getOriginalCurrent = (trait: string) => {
      if (trait === 'Freq') return displayState.currFreq;
      if (trait === 'Temp') return displayState.currTemp;
      if (trait === 'pH') return displayState.currPH;
      if (trait === 'Salinity') return displayState.currSal;
      return 0;
    };
    
    const getOriginalTarget = (trait: string) => {
      if (trait === 'Freq') return displayState.targetFreq;
      if (trait === 'Temp') return displayState.targetTemp;
      if (trait === 'pH') return displayState.targetPH;
      if (trait === 'Salinity') return displayState.targetSal;
      return 0;
    };
    
    // Apply each item in order
    const itemEntries = Array.from(selectedItemsForGoob.entries());
    for (const [itemId, count] of itemEntries) {
      // Apply item count times
      for (let i = 0; i < count; i++) {
        const metadata = getItemMetadata(itemId);
        if (!metadata?.attributes) continue;
        
        // Parse item attributes
        let rarity: string | null = null;
        let primaryTrait: string | null = null;
        let primaryDeltaMagnitude: number | null = null;
        let secondaryTrait: string | null = null;
        let secondaryDeltaMagnitude: number | null = null;
        
        for (const attr of metadata.attributes) {
          if (attr.trait_type === 'Rarity') {
            rarity = String(attr.value).trim();
          } else if (attr.trait_type === 'Primary Trait') {
            const value = String(attr.value).toLowerCase().trim();
            if (value.includes('frequency')) primaryTrait = 'Freq';
            else if (value.includes('temperature')) primaryTrait = 'Temp';
            else if (value.includes('ph') || value === 'ph') primaryTrait = 'pH';
            else if (value.includes('salinity')) primaryTrait = 'Salinity';
          } else if (attr.trait_type === 'Primary Delta Magnitude') {
            primaryDeltaMagnitude = typeof attr.value === 'number' ? Math.abs(attr.value) : Math.abs(parseInt(String(attr.value), 10));
          } else if (attr.trait_type === 'Secondary Trait') {
            const value = String(attr.value).toLowerCase().trim();
            if (value.includes('frequency')) secondaryTrait = 'Freq';
            else if (value.includes('temperature')) secondaryTrait = 'Temp';
            else if (value.includes('ph') || value === 'ph') secondaryTrait = 'pH';
            else if (value.includes('salinity')) secondaryTrait = 'Salinity';
          } else if (attr.trait_type === 'Secondary Delta Magnitude') {
            // Store as absolute value - sign will be determined by primary delta direction
            secondaryDeltaMagnitude = typeof attr.value === 'number' ? Math.abs(attr.value) : Math.abs(parseInt(String(attr.value), 10));
          }
        }
        
        // Calculate primary direction based on ORIGINAL state (before any items applied)
        let primaryDirection = 1;
        if (primaryTrait) {
          const originalCurrent = getOriginalCurrent(primaryTrait);
          const originalTarget = getOriginalTarget(primaryTrait);
          primaryDirection = originalCurrent > originalTarget ? -1 : 1;
        }
        
        // Apply item effects
        if (rarity?.toLowerCase() === 'epic') {
          // Epic logic: use selected trait (or worst trait if not selected), pull it closer, push others away
          const traits = [
            { name: 'Freq', current: preview.currFreq, target: preview.targetFreq, locked: preview.lockedFreq },
            { name: 'Temp', current: preview.currTemp, target: preview.targetTemp, locked: preview.lockedTemp },
            { name: 'pH', current: preview.currPH, target: preview.targetPH, locked: preview.lockedPH },
            { name: 'Salinity', current: preview.currSal, target: preview.targetSal, locked: preview.lockedSal },
          ];
          
          // Use selected Epic trait, or find worst trait if not selected
          let targetTrait = null;
          if (selectedEpicTrait) {
            // Use the selected trait
            targetTrait = traits.find(t => t.name === selectedEpicTrait && !t.locked);
          }
          
          // If no valid selected trait, find worst trait (largest percent error)
          if (!targetTrait) {
            let worstError = -1;
            for (const trait of traits) {
              if (trait.locked) continue;
              const error = trait.target === 0 ? Math.abs(trait.current) : Math.abs((trait.current - trait.target) / trait.target);
              if (error > worstError) {
                worstError = error;
                targetTrait = trait;
              }
            }
          }
          
          if (targetTrait) {
            // Pull target trait closer (halve error or move to 2*5% = 10%)
            const error = targetTrait.current - targetTrait.target;
            const LOCK_PCT = 0.05;
            let newError: number;
            if (targetTrait.target === 0) {
              newError = error * 0.5;
            } else {
              const distPct = Math.abs(error) / Math.abs(targetTrait.target);
              if (distPct > 2 * LOCK_PCT) {
                newError = (2 * LOCK_PCT) * Math.abs(targetTrait.target) * (error >= 0 ? 1 : -1);
              } else {
                newError = error * 0.5;
              }
            }
            
            const newCurrent = targetTrait.target + newError;
            if (targetTrait.name === 'Freq') preview.currFreq = Math.max(0, Math.min(100, Math.round(newCurrent)));
            else if (targetTrait.name === 'Temp') preview.currTemp = Math.max(0, Math.min(100, Math.round(newCurrent)));
            else if (targetTrait.name === 'pH') preview.currPH = Math.max(0, Math.min(100, Math.round(newCurrent)));
            else if (targetTrait.name === 'Salinity') preview.currSal = Math.max(0, Math.min(100, Math.round(newCurrent)));
            
            // Push other unlocked traits 10% further away
            for (const trait of traits) {
              if (trait.locked || trait === targetTrait) continue;
              const error = trait.current - trait.target;
              const newError = error * 1.1; // 10% further
              const newCurrent = trait.target + newError;
              if (trait.name === 'Freq') preview.currFreq = Math.max(0, Math.min(100, Math.round(newCurrent)));
              else if (trait.name === 'Temp') preview.currTemp = Math.max(0, Math.min(100, Math.round(newCurrent)));
              else if (trait.name === 'pH') preview.currPH = Math.max(0, Math.min(100, Math.round(newCurrent)));
              else if (trait.name === 'Salinity') preview.currSal = Math.max(0, Math.min(100, Math.round(newCurrent)));
            }
          }
        } else if (primaryTrait && primaryDeltaMagnitude !== null) {
          // Linear item: apply primary and secondary deltas
          // Primary delta moves toward target
          const getCurrent = (trait: string) => {
            if (trait === 'Freq') return preview.currFreq;
            if (trait === 'Temp') return preview.currTemp;
            if (trait === 'pH') return preview.currPH;
            if (trait === 'Salinity') return preview.currSal;
            return 0;
          };
          
          const getLocked = (trait: string) => {
            if (trait === 'Freq') return preview.lockedFreq;
            if (trait === 'Temp') return preview.lockedTemp;
            if (trait === 'pH') return preview.lockedPH;
            if (trait === 'Salinity') return preview.lockedSal;
            return false;
          };
          
          const setCurrent = (trait: string, value: number) => {
            const clamped = Math.max(0, Math.min(100, Math.round(value)));
            if (trait === 'Freq') preview.currFreq = clamped;
            else if (trait === 'Temp') preview.currTemp = clamped;
            else if (trait === 'pH') preview.currPH = clamped;
            else if (trait === 'Salinity') preview.currSal = clamped;
          };
          
          // Apply primary delta (toward target) - direction based on original state
          if (!getLocked(primaryTrait)) {
            const current = getCurrent(primaryTrait);
            const delta = primaryDirection * primaryDeltaMagnitude;
            setCurrent(primaryTrait, current + delta);
          }
          
          // Apply secondary delta (if exists) - same sign as primary delta
          if (secondaryTrait && secondaryDeltaMagnitude !== null && !getLocked(secondaryTrait)) {
            const current = getCurrent(secondaryTrait);
            const delta = primaryDirection * secondaryDeltaMagnitude; // Same sign as primary
            setCurrent(secondaryTrait, current + delta);
          }
        }
      }
    }
    
    return preview;
  }, [isInitialized, displayState, selectedItemsForGoob, getItemMetadata, selectedEpicTrait]);
  
  // Helper to calculate percentage difference
  const calculatePercentDifference = (current: number, target: number): number => {
    if (target === 0) return 0;
    return Math.abs((current - target) / target) * 100;
  };
  
  // Helper to get color class based on percentage difference
  const getDifferenceColorClass = (percentDiff: number): string => {
    if (percentDiff < 5) return styles.differenceGreen;
    if (percentDiff < 10) return styles.differenceYellow;
    if (percentDiff < 20) return styles.differenceOrange;
    return styles.differenceRed;
  };
  
  // Handler for applying changes
  const handleApplyChanges = () => {
    if (!previewState || !displayState || !setSelectedItemsForGoob) return;
    
    // Close apply modal and show processing
    setShowApplyChangesModal(false);
    setIsProcessingApply(true);
    
    // After 1 second delay, apply changes
    setTimeout(() => {
      // Update simulated creature state if in simulation mode
      if (isSimulating) {
        const updatedState = {
          ...displayState,
          currFreq: previewState.currFreq,
          currTemp: previewState.currTemp,
          currPH: previewState.currPH,
          currSal: previewState.currSal,
        };
        setSimulatedCreatureState(tokenId, updatedState);
        // Force refresh to pick up new state
        setRefreshKey(prev => prev + 1);
      }
      
      // Clear items from Goob Item Area (simulated burn)
      if (setSelectedItemsForGoob) {
        setSelectedItemsForGoob(new Map());
      }
      
      // Hide processing and show success modal
      setIsProcessingApply(false);
      setShowApplySuccessModal(true);
    }, 1000);
  };
  
  // Calculate total item count for modal
  const totalItemCount = React.useMemo(() => {
    return Array.from(selectedItemsForGoob.values()).reduce((sum, count) => sum + count, 0);
  }, [selectedItemsForGoob]);

  return (
    <div className={styles.expandedGoobContainer}>
      <button
        className={styles.expandedCloseButton}
        onClick={onClose}
        aria-label="Close expanded view"
      >
        ×
      </button>
      <div className={styles.expandedGoobContent}>
        {isLoading ? (
          <div className={styles.expandedLoading}>Loading...</div>
        ) : imageUrl ? (
          <div className={styles.expandedImageWrapper}>
            <div className={styles.expandedVibesReadout}>
              Vibes: {isInitialized && displayState ? displayState.vibes : '—'}
            </div>
            <img
              src={imageUrl}
              alt={`Goob #${tokenId.toString()}`}
              className={styles.expandedGoobImage}
            />
            {/* Traits Table - positioned at bottom of image */}
            <div className={styles.expandedTraitsTable}>
          <div className={styles.expandedTraitsHeader}>
            <div className={styles.expandedTraitHeader}>Freq</div>
            <div className={styles.expandedTraitHeader}>Temp</div>
            <div className={styles.expandedTraitHeader}>pH</div>
            <div className={styles.expandedTraitHeader}>Salinity</div>
          </div>
          <div className={styles.expandedTraitsRow}>
            <span className={styles.expandedTraitRowLabel}>Target</span>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                displayState.targetFreq
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                displayState.targetTemp
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                displayState.targetPH
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                displayState.targetSal
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
          </div>
          <div className={styles.expandedTraitsRow}>
            <span className={styles.expandedTraitRowLabel}>State</span>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                <>
                  {displayState.currFreq}
                  {displayState.lockedFreq && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                <>
                  {displayState.currTemp}
                  {displayState.lockedTemp && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                <>
                  {displayState.currPH}
                  {displayState.lockedPH && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                <>
                  {displayState.currSal}
                  {displayState.lockedSal && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
          </div>
          <div className={styles.expandedTraitsRow}>
            <span className={styles.expandedTraitRowLabel}>Error</span>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                <span className={getDifferenceColorClass(calculatePercentDifference(displayState.currFreq, displayState.targetFreq))}>
                  {calculatePercentDifference(displayState.currFreq, displayState.targetFreq).toFixed(1)}%
                </span>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                <span className={getDifferenceColorClass(calculatePercentDifference(displayState.currTemp, displayState.targetTemp))}>
                  {calculatePercentDifference(displayState.currTemp, displayState.targetTemp).toFixed(1)}%
                </span>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                <span className={getDifferenceColorClass(calculatePercentDifference(displayState.currPH, displayState.targetPH))}>
                  {calculatePercentDifference(displayState.currPH, displayState.targetPH).toFixed(1)}%
                </span>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && displayState ? (
                <span className={getDifferenceColorClass(calculatePercentDifference(displayState.currSal, displayState.targetSal))}>
                  {calculatePercentDifference(displayState.currSal, displayState.targetSal).toFixed(1)}%
                </span>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
          </div>
            </div>
          </div>
        ) : (
          <div className={styles.expandedLoading}>No image available</div>
        )}
        
        {/* Preview Table - shown when items are selected */}
        {imageUrl && !isLoading && selectedItemsForGoob.size > 0 && previewState && (
          <div className={styles.previewTableContainer}>
            <div className={styles.previewTableTitle}>Preview</div>
            <div className={styles.previewTable}>
              <div className={styles.expandedTraitsHeader}>
                <div className={styles.expandedTraitHeader}>Freq</div>
                <div className={styles.expandedTraitHeader}>Temp</div>
                <div className={styles.expandedTraitHeader}>pH</div>
                <div className={styles.expandedTraitHeader}>Salinity</div>
              </div>
              <div className={styles.expandedTraitsRow}>
                <span className={styles.expandedTraitRowLabel}>New State</span>
                <div className={styles.expandedTraitCell}>
                  {previewState.currFreq}
                  {previewState.lockedFreq && <span className={styles.lockedBadge}> LOCKED</span>}
                </div>
                <div className={styles.expandedTraitCell}>
                  {previewState.currTemp}
                  {previewState.lockedTemp && <span className={styles.lockedBadge}> LOCKED</span>}
                </div>
                <div className={styles.expandedTraitCell}>
                  {previewState.currPH}
                  {previewState.lockedPH && <span className={styles.lockedBadge}> LOCKED</span>}
                </div>
                <div className={styles.expandedTraitCell}>
                  {previewState.currSal}
                  {previewState.lockedSal && <span className={styles.lockedBadge}> LOCKED</span>}
                </div>
              </div>
              <div className={styles.expandedTraitsRow}>
                <span className={styles.expandedTraitRowLabel}>Change</span>
                {(() => {
                  if (!displayState) return null;
                  const changeFreq = previewState.currFreq - displayState.currFreq;
                  const changeTemp = previewState.currTemp - displayState.currTemp;
                  const changePH = previewState.currPH - displayState.currPH;
                  const changeSal = previewState.currSal - displayState.currSal;
                  
                  // Helper to determine if change actually moves closer to target
                  // Checks if the new state is closer to target than the current state
                  const isCloserToTarget = (change: number, current: number, target: number): boolean => {
                    if (change === 0) return true; // No change
                    
                    const currentDistance = Math.abs(current - target);
                    const newState = current + change;
                    const newDistance = Math.abs(newState - target);
                    
                    // Green if new state is closer to target (or same distance)
                    return newDistance <= currentDistance;
                  };
                  
                  return (
                    <>
                      <div className={styles.expandedTraitCell}>
                        <span style={{ color: isCloserToTarget(changeFreq, displayState.currFreq, displayState.targetFreq) ? '#10b981' : '#ef4444' }}>
                          {changeFreq > 0 ? '+' : ''}{changeFreq}
                        </span>
                      </div>
                      <div className={styles.expandedTraitCell}>
                        <span style={{ color: isCloserToTarget(changeTemp, displayState.currTemp, displayState.targetTemp) ? '#10b981' : '#ef4444' }}>
                          {changeTemp > 0 ? '+' : ''}{changeTemp}
                        </span>
                      </div>
                      <div className={styles.expandedTraitCell}>
                        <span style={{ color: isCloserToTarget(changePH, displayState.currPH, displayState.targetPH) ? '#10b981' : '#ef4444' }}>
                          {changePH > 0 ? '+' : ''}{changePH}
                        </span>
                      </div>
                      <div className={styles.expandedTraitCell}>
                        <span style={{ color: isCloserToTarget(changeSal, displayState.currSal, displayState.targetSal) ? '#10b981' : '#ef4444' }}>
                          {changeSal > 0 ? '+' : ''}{changeSal}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className={styles.expandedTraitsRow}>
                <span className={styles.expandedTraitRowLabel}>New Error</span>
                <div className={styles.expandedTraitCell}>
                  <span className={getDifferenceColorClass(calculatePercentDifference(previewState.currFreq, previewState.targetFreq))}>
                    {calculatePercentDifference(previewState.currFreq, previewState.targetFreq).toFixed(1)}%
                  </span>
                </div>
                <div className={styles.expandedTraitCell}>
                  <span className={getDifferenceColorClass(calculatePercentDifference(previewState.currTemp, previewState.targetTemp))}>
                    {calculatePercentDifference(previewState.currTemp, previewState.targetTemp).toFixed(1)}%
                  </span>
                </div>
                <div className={styles.expandedTraitCell}>
                  <span className={getDifferenceColorClass(calculatePercentDifference(previewState.currPH, previewState.targetPH))}>
                    {calculatePercentDifference(previewState.currPH, previewState.targetPH).toFixed(1)}%
                  </span>
                </div>
                <div className={styles.expandedTraitCell}>
                  <span className={getDifferenceColorClass(calculatePercentDifference(previewState.currSal, previewState.targetSal))}>
                    {calculatePercentDifference(previewState.currSal, previewState.targetSal).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            {/* Apply Button */}
            <button
              onClick={() => setShowApplyChangesModal(true)}
              style={{
                marginTop: '16px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#000',
                backgroundColor: '#10b981',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
                maxWidth: '300px',
                margin: '16px auto 0',
                display: 'block',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#059669';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#10b981';
              }}
            >
              Apply Changes
            </button>
          </div>
        )}
        
        {/* Items instruction container */}
        {imageUrl && !isLoading && (
          <div className={styles.expandedItemsInstruction} ref={goobItemAreaRef}>
            {selectedItemsForGoob.size > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {hasEpicItem ? (
                  <>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textAlign: 'center' }}>
                      Epic item automatically selected {worstTraitForEpic}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textAlign: 'center' }}>
                      select different attribute if desired
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {(['Freq', 'Temp', 'pH', 'Salinity'] as const).map((trait) => {
                        const isLocked = trait === 'Freq' ? (displayState?.lockedFreq || false) :
                                         trait === 'Temp' ? (displayState?.lockedTemp || false) :
                                         trait === 'pH' ? (displayState?.lockedPH || false) :
                                         (displayState?.lockedSal || false);
                        const isSelected = selectedEpicTrait === trait;
                        return (
                          <button
                            key={trait}
                            onClick={() => !isLocked && setSelectedEpicTrait(trait)}
                            disabled={isLocked}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: isSelected ? 600 : 400,
                              color: isLocked ? 'rgba(128, 128, 128, 0.5)' : (isSelected ? 'rgb(110, 231, 183)' : 'var(--muted)'),
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                              border: isSelected ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                              cursor: isLocked ? 'not-allowed' : 'pointer',
                              opacity: isLocked ? 0.5 : 1,
                            }}
                          >
                            {trait}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textAlign: 'center' }}>
                    Choose up to 3 items below to apply to Goob
                  </div>
                )}
                <div 
                  className={styles.selectedItemsGrid}
                  style={hasEpicItem ? { justifyContent: 'center' } : undefined}
                >
                  {Array.from(selectedItemsForGoob.entries()).map(([itemId, count]) => (
                    <SelectedItemDisplay 
                      key={itemId} 
                      itemId={itemId} 
                      count={count}
                      selectedItemsForGoob={selectedItemsForGoob}
                      setSelectedItemsForGoob={setSelectedItemsForGoob}
                      onRestoreItem={onRestoreItem}
                      goobState={displayState}
                    />
                  ))}
                </div>
                {hasEpicItem && (
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', textAlign: 'center' }}>
                    Epic items can only be applied alone
                  </div>
                )}
              </div>
            ) : (
              <div>Choose up to 3 items below to apply to Goob</div>
            )}
          </div>
        )}
      </div>
      
      {/* Apply Changes Modal */}
      {showApplyChangesModal && previewState && displayState && (
        <ApplyChangesModal
          itemCount={totalItemCount}
          changes={{
            freq: previewState.currFreq - displayState.currFreq,
            temp: previewState.currTemp - displayState.currTemp,
            ph: previewState.currPH - displayState.currPH,
            salinity: previewState.currSal - displayState.currSal,
          }}
          currentState={{
            freq: displayState.currFreq,
            temp: displayState.currTemp,
            ph: displayState.currPH,
            salinity: displayState.currSal,
          }}
          targetState={{
            freq: displayState.targetFreq,
            temp: displayState.targetTemp,
            ph: displayState.targetPH,
            salinity: displayState.targetSal,
          }}
          selectedItems={selectedItemsForGoob}
          onApply={handleApplyChanges}
          onClose={() => setShowApplyChangesModal(false)}
        />
      )}
      
      {/* Processing Overlay */}
      {isProcessingApply && (
        <div className={styles.fakeTransactionOverlay}>
          <div className={styles.processingOverlay}>
            <div className={styles.spinner}></div>
          </div>
        </div>
      )}
      
      {/* Apply Success Modal */}
      {showApplySuccessModal && (
        <ApplySuccessModal
          onClose={() => {
            setShowApplySuccessModal(false);
          }}
        />
      )}
    </div>
  );
};

// Separate component for Goob card with metadata
const GoobCard: React.FC<{
  tokenId: bigint;
  isSelected: boolean;
  isSelectedForBatch: boolean;
  showPlusButton: boolean;
  isWaitingRoom: boolean;
  onSelect: () => void;
  onSelectForBatch: (e: React.MouseEvent) => void;
}> = ({ tokenId, isSelected, isSelectedForBatch, showPlusButton, isWaitingRoom, onSelect, onSelectForBatch }) => {
  const { metadata, isLoading } = useGoobMetadata(tokenId);

  // Get image URL (prefer image_data for on-chain, fallback to image)
  const imageUrl = metadata?.image_data || metadata?.image || null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (isWaitingRoom) {
          // In Waiting Room: clicking anywhere on card = same as clicking + button
          onSelectForBatch(e);
        } else {
          // In Lab: expand the Goob
          onSelect();
        }
      }}
      className={`${cardStyles.goobCard} ${isSelected ? cardStyles.selected : ''} ${isSelectedForBatch ? cardStyles.selectedForBatch : ''}`}
      style={{ 
        WebkitTapHighlightColor: 'rgba(16, 185, 129, 0.2)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isSelectedForBatch) {
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isSelectedForBatch) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.backgroundColor = 'transparent';
        } else if (isSelectedForBatch) {
          // Maintain green border for batch-selected Goobs
          e.currentTarget.style.borderColor = 'rgb(16, 185, 129)';
        }
      }}
      onTouchStart={(e) => {
        if (!isSelected && !isSelectedForBatch) {
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        }
      }}
      onTouchEnd={(e) => {
        if (!isSelected && !isSelectedForBatch) {
          setTimeout(() => {
            if (e.currentTarget) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }, 150);
        } else if (isSelectedForBatch && e.currentTarget) {
          // Maintain green border for batch-selected Goobs
          e.currentTarget.style.borderColor = 'rgb(16, 185, 129)';
        }
      }}
    >
      {/* Image Section */}
      <div 
        style={{ 
          width: '100%',
          minHeight: '132px',
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          padding: '0',
          margin: '0',
          position: 'relative',
        }}
      >
        {isLoading ? (
          <div style={{ fontSize: '8px', color: 'var(--muted)' }}>Loading...</div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={`Goob #${tokenId.toString()}`}
            className={cardStyles.goobImage}
            loading="eager"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div style={{ fontSize: '8px', color: 'var(--muted)' }}>No image</div>
        )}

        {/* Plus/Checkmark button in top right - only show in Waiting Room */}
        {showPlusButton && (
          <button
            onClick={onSelectForBatch}
            className={cardStyles.addButton}
            style={{
              color: isSelectedForBatch ? 'rgb(16, 185, 129)' : 'var(--muted)',
            }}
          >
            {isSelectedForBatch ? '✓' : '+'}
          </button>
        )}

        {/* Essence traits in bottom left */}
        {metadata?.essence && Object.keys(metadata.essence).length > 0 && (
          <div style={{ 
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
          }}>
            {Object.entries(metadata.essence).slice(0, 2).map(([key, value]) => (
              <div
                key={key}
                style={{ 
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  backdropFilter: 'blur(4px)',
                  fontWeight: 300,
                  color: 'var(--muted)',
                }}
              >
                {String(value)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div 
        style={{ 
          width: '100%',
          height: '33px',
          minHeight: '33px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <div 
          className={cardStyles.goobIdText}
          style={{ 
            color: isSelected ? 'rgb(110, 231, 183)' : 'var(--muted)',
            marginBottom: isSelected ? '2px' : '0',
          }}
        >
          #{tokenId.toString()}
        </div>
        {isSelected && (
          <div className={cardStyles.checkmark}>✓</div>
        )}
      </div>

    </button>
  );
};

// Component to display a selected item in the "Choose items below" area
const SelectedItemDisplay: React.FC<{ 
  itemId: number; 
  count: number;
  selectedItemsForGoob?: Map<number, number>;
  setSelectedItemsForGoob?: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onRestoreItem?: (itemId: number) => void;
  goobState?: any; // Current Goob state to determine secondary effect direction
}> = ({ itemId, count, selectedItemsForGoob: _selectedItemsForGoob, setSelectedItemsForGoob, onRestoreItem, goobState }) => {
  const { metadata, isLoading } = useItemMetadata(itemId);
  const imageUrl = metadata?.image || metadata?.image_data || null;
  
  const handleRemove = () => {
    if (setSelectedItemsForGoob && onRestoreItem) {
      setSelectedItemsForGoob(prev => {
        const next = new Map(prev);
        const currentCount = next.get(itemId) || 0;
        if (currentCount > 1) {
          next.set(itemId, currentCount - 1);
        } else {
          next.delete(itemId);
        }
        return next;
      });
      onRestoreItem(itemId);
    }
  };
  
  // Check if item is Epic
  const isEpic = React.useMemo(() => {
    if (!metadata?.attributes) return false;
    for (const attr of metadata.attributes) {
      if (attr.trait_type === 'Rarity') {
        const value = String(attr.value).toLowerCase().trim();
        if (value === 'epic') return true;
      }
    }
    return false;
  }, [metadata?.attributes]);
  
  return (
    <div 
      style={{
      width: '132px',
      flexShrink: 0,
      minHeight: '132px',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '4px',
      border: isEpic ? '2px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.2)',
      overflow: 'visible',
      margin: '0',
      padding: '0',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Image Section */}
      <div style={{
        width: '100%',
        minHeight: '99px',
        backgroundColor: 'rgba(128, 128, 128, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        padding: '0',
        margin: '0',
        position: 'relative',
      }}>
        {isLoading ? (
          <div style={{ fontSize: '8px', color: 'var(--muted)' }}>Loading...</div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={metadata?.name || `Item #${itemId}`}
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              padding: '0',
              margin: '0',
              display: 'block',
            }}
          />
        ) : (
          <div style={{ fontSize: '8px', color: 'var(--muted)' }}>No image</div>
        )}
        {count > 1 && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            fontSize: '10px',
            color: 'rgb(110, 231, 183)',
            fontWeight: 600,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '2px 4px',
            borderRadius: '2px',
          }}>
            x{count}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div style={{
        width: '100%',
        height: 'auto',
        minHeight: '33px',
        padding: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 300,
          lineHeight: '1.2',
          textAlign: 'center',
          color: 'var(--muted)',
          marginBottom: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}>
          {metadata?.name || `Item #${itemId}`}
        </div>
        {/* Trait and magnitude display */}
        {metadata?.attributes && (() => {
          let primaryTrait: string | null = null;
          let primaryDeltaMagnitude: number | null = null;
          let secondaryTrait: string | null = null;
          let secondaryDeltaMagnitude: number | null = null;
          
          for (const attr of metadata.attributes) {
            if (attr.trait_type === 'Primary Trait') {
              const value = String(attr.value).toLowerCase();
              if (value.includes('frequency')) {
                primaryTrait = 'Freq';
              } else if (value.includes('temperature')) {
                primaryTrait = 'Temp';
              } else if (value.includes('ph') || value === 'ph') {
                primaryTrait = 'pH';
              } else if (value.includes('salinity')) {
                primaryTrait = 'Salinity';
              }
            } else if (attr.trait_type === 'Primary Delta Magnitude') {
              primaryDeltaMagnitude = typeof attr.value === 'number' ? Math.abs(attr.value) : Math.abs(parseInt(String(attr.value), 10));
            } else if (attr.trait_type === 'Secondary Trait') {
              const value = String(attr.value).toLowerCase();
              if (value.includes('frequency')) {
                secondaryTrait = 'Freq';
              } else if (value.includes('temperature')) {
                secondaryTrait = 'Temp';
              } else if (value.includes('ph') || value === 'ph') {
                secondaryTrait = 'pH';
              } else if (value.includes('salinity')) {
                secondaryTrait = 'Salinity';
              }
            } else if (attr.trait_type === 'Secondary Delta Magnitude') {
              secondaryDeltaMagnitude = typeof attr.value === 'number' ? Math.abs(attr.value) : Math.abs(parseInt(String(attr.value), 10));
            }
          }
          
          // Calculate primary direction based on current Goob state
          let primaryDirection = 1;
          if (primaryTrait && goobState) {
            const getCurrent = (t: string) => {
              if (t === 'Freq') return goobState.currFreq;
              if (t === 'Temp') return goobState.currTemp;
              if (t === 'pH') return goobState.currPH;
              if (t === 'Salinity') return goobState.currSal;
              return 0;
            };
            const getTarget = (t: string) => {
              if (t === 'Freq') return goobState.targetFreq;
              if (t === 'Temp') return goobState.targetTemp;
              if (t === 'pH') return goobState.targetPH;
              if (t === 'Salinity') return goobState.targetSal;
              return 0;
            };
            const current = getCurrent(primaryTrait);
            const target = getTarget(primaryTrait);
            primaryDirection = current > target ? -1 : 1;
          }
          
          // Calculate actual deltas with correct signs
          const primaryDelta = primaryDeltaMagnitude !== null ? primaryDirection * primaryDeltaMagnitude : null;
          const secondaryDelta = secondaryDeltaMagnitude !== null ? primaryDirection * secondaryDeltaMagnitude : null;
          
          // Helper to determine if effect moves towards target (always true for primary, check for secondary)
          const isTowardsTarget = (trait: string, delta: number): boolean => {
            if (!goobState || delta === 0) return true;
            const getCurrent = (t: string) => {
              if (t === 'Freq') return goobState.currFreq;
              if (t === 'Temp') return goobState.currTemp;
              if (t === 'pH') return goobState.currPH;
              if (t === 'Salinity') return goobState.currSal;
              return 0;
            };
            const getTarget = (t: string) => {
              if (t === 'Freq') return goobState.targetFreq;
              if (t === 'Temp') return goobState.targetTemp;
              if (t === 'pH') return goobState.targetPH;
              if (t === 'Salinity') return goobState.targetSal;
              return 0;
            };
            const current = getCurrent(trait);
            const target = getTarget(trait);
            const newValue = current + delta;
            const distanceBefore = Math.abs(current - target);
            const distanceAfter = Math.abs(newValue - target);
            return distanceAfter < distanceBefore;
          };
          
          return (
            <>
              {primaryTrait && primaryDelta !== null && (
                <div 
                  style={{ 
                    fontSize: '15px',
                    fontWeight: 300,
                    lineHeight: '1.2',
                    textAlign: 'center',
                    marginTop: '2px',
                    width: '100%',
                    color: '#10b981', // Primary always moves towards target (green)
                  }}
                >
                  {primaryTrait} {primaryDelta > 0 ? '+' : ''}{primaryDelta}
                </div>
              )}
              {secondaryTrait && secondaryDelta !== null && (
                <div 
                  style={{ 
                    fontSize: '15px',
                    fontWeight: 300,
                    lineHeight: '1.2',
                    textAlign: 'center',
                    marginTop: '2px',
                    width: '100%',
                    color: isTowardsTarget(secondaryTrait, secondaryDelta) ? '#10b981' : '#ef4444',
                  }}
                >
                  {secondaryTrait} {secondaryDelta > 0 ? '+' : ''}{secondaryDelta}
                </div>
              )}
            </>
          );
        })()}
        {/* Remove Button */}
        <button
          onClick={handleRemove}
          style={{
            marginTop: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 500,
            color: '#ef4444',
            backgroundColor: 'transparent',
            border: '1px solid #ef4444',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
};

