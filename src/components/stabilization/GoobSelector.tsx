// src/components/stabilization/GoobSelector.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useUserGoobs } from '../../hooks/goobs/useUserGoobs';
import { useSimulatedGoobs } from '../../hooks/goobs/useSimulatedGoobs';
import { useGoobMetadata } from '../../hooks/goobs/useGoobMetadata';
import { useCreatureState } from '../../hooks/stabilizationV3/useCreatureState';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
import { useSendVibes } from '../../hooks/stabilizationV3/useSendVibes';
import { useLockTrait } from '../../hooks/stabilizationV3/useLockTrait';
import { useWalletSP } from '../../hooks/stabilizationV3/useWalletSP';
import { useQueryClient } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { STAB_V3_ADDRESS, ITEM_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';
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

type LabFilter = 'Waiting Room' | 'Lab' | 'Resonance';

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
      // Still dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('goobs-in-lab-updated'));
      return;
    }
    
    try {
      const ids = Array.from(goobsInLab);
      console.log('[GoobsInLab] Saving to localStorage:', storageKey, ids);
      localStorage.setItem(storageKey, JSON.stringify(ids));
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('goobs-in-lab-updated'));
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
  const [resonanceUpdateKey, setResonanceUpdateKey] = useState(0);
  
  // Listen for resonance achievement events to update counter
  useEffect(() => {
    const handleResonanceUpdate = () => {
      setResonanceUpdateKey(prev => prev + 1);
    };
    window.addEventListener('goob-resonance-achieved', handleResonanceUpdate);
    return () => {
      window.removeEventListener('goob-resonance-achieved', handleResonanceUpdate);
    };
  }, []);

  // Helper to check if a Goob is in resonance (all 4 traits locked)
  // Note: Goobs in resonance are removed from goobsInLab, so we check locked state directly
  const isGoobInResonance = React.useCallback((tokenId: bigint): boolean => {
    if (isSimulating) {
      const simulatedState = getSimulatedCreatureState(tokenId);
      if (simulatedState) {
        return simulatedState.lockedCount === 4;
      }
      return false;
    } else {
      // For real mode, we'd need to check on-chain state
      // For now, we'll use a simple check - this could be optimized with a hook
      // that batches state checks
      return false; // Will be updated when we have on-chain state access
    }
  }, [isSimulating]);

  // Count Goobs in each category (calculate before early returns for useEffect)
  // Force recalculation by checking all Goobs' states directly
  const resonanceCount = React.useMemo(() => {
    if (isSimulating) {
      // In simulation, check each Goob's locked state directly
      return goobs.filter((g: { tokenId: bigint }) => {
        const state = getSimulatedCreatureState(g.tokenId);
        return state?.lockedCount === 4;
      }).length;
    }
    return goobs.filter((g: { tokenId: bigint }) => isGoobInResonance(g.tokenId)).length;
  }, [goobs, isGoobInResonance, isSimulating, resonanceUpdateKey]);

  const labCount = React.useMemo(() => {
    return goobs.filter((g: { tokenId: bigint }) => {
      const idStr = g.tokenId.toString();
      const inLab = goobsInLab.has(idStr);
      return inLab && !isGoobInResonance(g.tokenId); // In lab but not in resonance
    }).length;
  }, [goobs, goobsInLab, isGoobInResonance]);

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
    
    if (labFilter === 'Resonance') {
      return isGoobInResonance(g.tokenId);
    } else if (labFilter === 'Lab') {
      return inLab && !isGoobInResonance(g.tokenId); // In lab but not in resonance
    } else {
      return !inLab; // Waiting Room
    }
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
            <button
              className={`${styles.filterButton} ${labFilter === 'Resonance' ? styles.filterButtonActive : ''}`}
              onClick={() => {
                setLabFilter('Resonance');
                setExpandedGoobId(null);
                onChange(null); // Clear selection when switching tabs
              }}
            >
              Resonance
            </button>
          </div>
          
          {/* Count readout */}
          <div className={styles.goobCountReadout}>
            Waiting Room: {waitingRoomCount} | Lab: {labCount} | Resonance: {resonanceCount}
          </div>
        </>
      )}
      
      {/* Title - "Goobs ####" when expanded */}
      {expandedGoobId && labFilter === 'Lab' && (
        <>
          <div className={styles.expandedTitle}>
            Goobs #{expandedGoobId.toString()}
          </div>
          {/* Send Vibes Button - positioned right after title */}
          <SendVibesButton 
            tokenId={expandedGoobId} 
            isSimulating={isSimulating}
          />
        </>
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
      ) : filteredGoobs.length === 0 && labFilter === 'Resonance' ? (
        <div className={styles.noGoobsContainer}>
          <div className={styles.noGoobsTitle}>You have no Goobs in Resonance</div>
        </div>
      ) : expandedGoobId && (labFilter === 'Lab' || labFilter === 'Resonance') ? (
        <ExpandedGoobView
          tokenId={expandedGoobId}
          onClose={() => {
            setExpandedGoobId(null);
            onChange(null); // Clear selectedGoobId in parent component
          }}
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
            const isInResonance = labFilter === 'Resonance' || isGoobInResonance(g.tokenId);
            return (
              <GoobCard
                key={g.tokenId.toString()}
                tokenId={g.tokenId}
                isSelected={isSelected}
                isSelectedForBatch={isSelectedForBatch}
                showPlusButton={labFilter === 'Waiting Room'}
                isWaitingRoom={labFilter === 'Waiting Room'}
                isSimulating={isSimulating}
                isInResonance={isInResonance}
                onSelect={() => {
                  if (labFilter === 'Lab' || labFilter === 'Resonance') {
                    // In Lab or Resonance: expand the Goob and set selectedId so ItemSelector knows
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
                  {item.category && item.category !== 'Epic' && (
                    <span className={styles.modalItemCategory}>
                      {item.category}
                      {item.magnitude !== undefined && ` ${item.magnitude}`}
                    </span>
                  )}
                  {item.category === 'Epic' && item.magnitude !== undefined && (
                    <span className={styles.modalItemCategory}>
                      {item.magnitude}
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

// Send Vibes Button Component
const SendVibesButton: React.FC<{
  tokenId: bigint;
  isSimulating: boolean;
}> = ({ tokenId, isSimulating }) => {
  const { state: creatureState } = useCreatureState(Number(tokenId));
  const { sendVibes, isPending: isSendingVibes, isSuccess: vibesSentSuccess } = useSendVibes();
  
  // Get simulated state if in simulation mode
  const simulatedState = isSimulating ? getSimulatedCreatureState(tokenId) : null;
  const displayState = simulatedState || creatureState;
  
  // Get lastVibesDay, GAME_START, and DAY_SECONDS from contract
  const { data: lastVibesDay, refetch: refetchLastVibesDay } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'lastVibesDay',
    args: [tokenId],
    query: {
      enabled: !isSimulating && tokenId > 0n,
    },
  });
  
  const { data: gameStart } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'GAME_START',
    query: {
      enabled: !isSimulating,
    },
  });
  
  const { data: daySeconds } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'DAY_SECONDS',
    query: {
      enabled: !isSimulating,
    },
  });
  
  const [showVibesAnimation, setShowVibesAnimation] = React.useState(false);
  const [timeUntilNextVibes, setTimeUntilNextVibes] = React.useState<number | null>(null);
  const countdownIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const manuallySetCountdownRef = React.useRef<boolean>(false);
  
  // Cleanup interval on unmount
  React.useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);
  
  // Store animation state in a way ExpandedGoobView can access it
  React.useEffect(() => {
    if (showVibesAnimation) {
      window.dispatchEvent(new CustomEvent('vibes-animation', { detail: { tokenId: tokenId.toString(), show: true } }));
    } else {
      window.dispatchEvent(new CustomEvent('vibes-animation', { detail: { tokenId: tokenId.toString(), show: false } }));
    }
  }, [showVibesAnimation, tokenId]);
  
  // Calculate time until next vibes can be sent - ONLY on mount or when dependencies change
  React.useEffect(() => {
    // In simulation mode, check localStorage for last vibes time
    if (isSimulating) {
      // Clear any existing interval first
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      
      const lastVibesKey = `last-vibes-time-${tokenId.toString()}`;
      const lastVibesTime = localStorage.getItem(lastVibesKey);
      if (lastVibesTime) {
        const lastTime = parseInt(lastVibesTime, 10);
        const now = Date.now();
        const timeLeft = (24 * 60 * 60 * 1000) - (now - lastTime);
        if (timeLeft > 0) {
          setTimeUntilNextVibes(timeLeft);
          const interval = setInterval(() => {
            const lastVibesTime = localStorage.getItem(lastVibesKey);
            if (lastVibesTime) {
              const lastTime = parseInt(lastVibesTime, 10);
              const currentTime = Date.now();
              const remaining = (24 * 60 * 60 * 1000) - (currentTime - lastTime);
              if (remaining <= 0) {
                setTimeUntilNextVibes(null);
                clearInterval(interval);
                countdownIntervalRef.current = null;
              } else {
                setTimeUntilNextVibes(remaining);
              }
            }
          }, 1000);
          countdownIntervalRef.current = interval;
          return () => {
            clearInterval(interval);
            if (countdownIntervalRef.current === interval) {
              countdownIntervalRef.current = null;
            }
          };
        } else {
          setTimeUntilNextVibes(null);
        }
      } else {
        setTimeUntilNextVibes(null);
      }
      return;
    }
    
    // Real mode: use contract data
    if (!lastVibesDay || !gameStart || !daySeconds) {
      setTimeUntilNextVibes(null);
      return;
    }
    
    const calculateTimeUntilNext = () => {
      const now = Math.floor(Date.now() / 1000);
      const gameStartTime = Number(gameStart);
      const daySecondsValue = Number(daySeconds);
      
      if (now < gameStartTime) {
        setTimeUntilNextVibes(null);
        return;
      }
      const lastVibesDayNum = Number(lastVibesDay);
      const nextVibesDay = lastVibesDayNum + 1;
      const nextVibesTimestamp = gameStartTime + (nextVibesDay * daySecondsValue);
      const timeLeft = (nextVibesTimestamp - now) * 1000;
      
      if (timeLeft <= 0) {
        setTimeUntilNextVibes(null);
      } else {
        setTimeUntilNextVibes(timeLeft);
      }
    };
    
    calculateTimeUntilNext();
    const interval = setInterval(calculateTimeUntilNext, 1000);
    return () => clearInterval(interval);
  }, [lastVibesDay, gameStart, daySeconds, isSimulating, tokenId]);
  
  // Handle vibes sent success
  React.useEffect(() => {
    if (vibesSentSuccess) {
      setShowVibesAnimation(true);
      setTimeout(() => setShowVibesAnimation(false), 2000);
      refetchLastVibesDay();
    }
  }, [vibesSentSuccess, refetchLastVibesDay]);
  
  // Format time until next vibes
  const formatTimeUntilNextVibes = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle send vibes
  const handleSendVibes = async () => {
    console.log('Send Vibes clicked!', { isSendingVibes, isSimulating, displayState });
    if (isSendingVibes) return;
    
    // In simulation mode, just update the local state
    if (isSimulating) {
      const currentState = displayState || getSimulatedCreatureState(tokenId);
      console.log('Current state:', currentState);
      if (currentState && typeof currentState.vibes === 'number' && currentState.vibes < 10) {
        const newVibes = Math.min(currentState.vibes + 1, 10);
        const updatedState = {
          ...currentState,
          vibes: newVibes,
        };
        setSimulatedCreatureState(tokenId, updatedState);
        
        // Trigger animations immediately - store in localStorage for ExpandedGoobView to read
        const animKey = `vibes-anim-${tokenId.toString()}`;
        localStorage.setItem(animKey, Date.now().toString());
        setShowVibesAnimation(true);
        window.dispatchEvent(new CustomEvent('vibes-animation', { 
          detail: { tokenId: tokenId.toString(), show: true } 
        }));
        setTimeout(() => {
          setShowVibesAnimation(false);
          window.dispatchEvent(new CustomEvent('vibes-animation', { 
            detail: { tokenId: tokenId.toString(), show: false } 
          }));
        }, 2000);
        
        // Set countdown immediately
        const lastVibesKey = `last-vibes-time-${tokenId.toString()}`;
        const now = Date.now();
        localStorage.setItem(lastVibesKey, now.toString());
        const countdownTime = 24 * 60 * 60 * 1000;
        
        // Clear any existing interval first
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        
        // Mark that we're manually setting the countdown
        manuallySetCountdownRef.current = true;
        
        // Set countdown state immediately
        setTimeUntilNextVibes(countdownTime);
        
        // State update will trigger re-render
        
        // Set up interval to update countdown every second
        countdownIntervalRef.current = setInterval(() => {
          const lastVibesTime = localStorage.getItem(lastVibesKey);
          if (lastVibesTime) {
            const lastTime = parseInt(lastVibesTime, 10);
            const currentTime = Date.now();
            const remaining = (24 * 60 * 60 * 1000) - (currentTime - lastTime);
            console.log('Countdown tick:', remaining);
            if (remaining <= 0) {
              setTimeUntilNextVibes(null);
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
            } else {
              setTimeUntilNextVibes(remaining);
            }
          }
        }, 1000);
        
        // State update will trigger re-render
        
        // ALSO force a state update by calling setTimeUntilNextVibes again in next tick
        setTimeout(() => {
          setTimeUntilNextVibes(countdownTime);
          console.log('FORCED COUNTDOWN UPDATE:', countdownTime);
        }, 0);
        
        // State update will trigger re-render
        
        // Also trigger a custom event to force ExpandedGoobView to refresh
        window.dispatchEvent(new CustomEvent('vibes-updated', { 
          detail: { tokenId: tokenId.toString(), newVibes } 
        }));
      }
      return;
    }
    
    // Real mode: call contract
    try {
      await sendVibes(Number(tokenId));
    } catch (error) {
      console.error('Failed to send vibes:', error);
    }
  };
  
  const showCountdown = timeUntilNextVibes !== null && timeUntilNextVibes > 0;
  
  // ALWAYS show countdown if there's time remaining (regardless of vibes level)
  if (showCountdown) {
    return (
      <div className={styles.sendVibesButtonContainer}>
        <div className={styles.vibesCountdown}>
          Send Vibes in {formatTimeUntilNextVibes(timeUntilNextVibes)}
        </div>
      </div>
    );
  }
  
  // If no countdown, only show button if vibes < 10
  if (!displayState || typeof displayState.vibes !== 'number' || displayState.vibes >= 10) {
    return null;
  }
  
  // Show button when vibes < 10 and no active countdown
  return (
    <div className={styles.sendVibesButtonContainer}>
      <button
        className={styles.sendVibesButton}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSendVibes();
        }}
        disabled={isSendingVibes}
        type="button"
      >
        {isSendingVibes ? 'Sending...' : 'Send Vibes'}
      </button>
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
  onGoobResonance?: (goobId: bigint) => void;
}> = ({ tokenId, onClose, selectedItemsForGoob = new Map(), setSelectedItemsForGoob, onRestoreItem, isSimulating = false, onGoobResonance }) => {
  const { metadata, isLoading } = useGoobMetadata(tokenId);
  const { state: creatureState } = useCreatureState(Number(tokenId));
  const { lockTrait: lockTraitContract, isPending: isLocking, isSuccess: isLockSuccess } = useLockTrait();
  const { sp: walletSPFromContract } = useWalletSP();
  const imageUrl = metadata?.image_data || metadata?.image || null;
  const queryClient = useQueryClient();
  
  // State for apply changes flow (declared early to avoid initialization errors)
  const [refreshKey, setRefreshKey] = React.useState(0);
  
  // State for lock trait fake transaction
  const [showLockTraitModal, setShowLockTraitModal] = React.useState(false);
  const [pendingLockTrait, setPendingLockTrait] = React.useState<{ name: string; cost: number } | null>(null);
  const [isProcessingLock, setIsProcessingLock] = React.useState(false);
  const [lockTraitError, setLockTraitError] = React.useState<string | null>(null);
  const [showLockSuccessModal, setShowLockSuccessModal] = React.useState(false);
  const [lockedTraitName, setLockedTraitName] = React.useState<string | null>(null);
  const [showResonanceModal, setShowResonanceModal] = React.useState(false);
  const [showResonanceConfetti, setShowResonanceConfetti] = React.useState(false);
  
  // Listen for resonance achievement events from ExpandedGoobView
  React.useEffect(() => {
    const handleResonanceAchieved = () => {
      setShowResonanceModal(true);
      setShowResonanceConfetti(true);
      setTimeout(() => setShowResonanceConfetti(false), 3000);
    };
    
    window.addEventListener('goob-resonance-achieved', handleResonanceAchieved);
    return () => {
      window.removeEventListener('goob-resonance-achieved', handleResonanceAchieved);
    };
  }, []);
  
  // Listen for SP updates in simulation mode
  const [spUpdateKey, setSPUpdateKey] = React.useState(0);
  React.useEffect(() => {
    const handleSPUpdate = () => {
      if (isSimulating) {
        setSPUpdateKey(prev => prev + 1);
      }
    };
    window.addEventListener('sp-updated', handleSPUpdate);
    return () => window.removeEventListener('sp-updated', handleSPUpdate);
  }, [isSimulating]);
  
  // Get bonded SP from creature state
  const bondedSP = React.useMemo(() => {
    if (isSimulating) {
      const simulatedState = getSimulatedCreatureState(tokenId);
      return simulatedState?.bondedSP || 0;
    } else if (creatureState) {
      return creatureState.bondedSP || 0;
    }
    return 0;
  }, [isSimulating, tokenId, creatureState]);
  
  // Get wallet SP (from contract in real mode, from localStorage in simulation mode)
  const walletSP = React.useMemo(() => {
    if (isSimulating) {
      try {
        const stored = localStorage.getItem('simulated-wallet-sp');
        return stored ? parseInt(stored, 10) : 0;
      } catch {
        return 0;
      }
    } else {
      return walletSPFromContract || 0;
    }
  }, [isSimulating, walletSPFromContract, spUpdateKey]);
  
  // Total available SP (bonded + wallet)
  const totalAvailableSP = React.useMemo(() => {
    return bondedSP + walletSP;
  }, [bondedSP, walletSP]);
  
  // Handle trait locking
  const handleLockTrait = React.useCallback(async (traitName: string, lockCost: number) => {
    // Clear any previous error
    setLockTraitError(null);
    
    // Check SP balance (bonded SP first, then wallet SP) - both real and simulation mode
    if (totalAvailableSP < lockCost) {
      setLockTraitError(`Not enough SP (need ${lockCost}, have ${totalAvailableSP}). Burn items to receive SP.`);
      return;
    }
    
    // Show fake transaction modal
    setPendingLockTrait({ name: traitName, cost: lockCost });
    setShowLockTraitModal(true);
  }, [totalAvailableSP]);
  
  // Clear error when SP changes and becomes sufficient
  React.useEffect(() => {
    if (lockTraitError && pendingLockTrait && totalAvailableSP >= pendingLockTrait.cost) {
      setLockTraitError(null);
    }
  }, [totalAvailableSP, lockTraitError, pendingLockTrait]);
  
  // Handle fake lock transaction sign
  const handleFakeLockSign = React.useCallback(async () => {
    if (!pendingLockTrait) return;
    
    // Check SP balance again before processing (in case it changed)
    if (totalAvailableSP < pendingLockTrait.cost) {
      setLockTraitError(`Not enough SP (need ${pendingLockTrait.cost}, have ${totalAvailableSP}). Burn items to receive SP.`);
      setShowLockTraitModal(false);
      return;
    }
    
    // Clear error before processing
    setLockTraitError(null);
    setShowLockTraitModal(false);
    setIsProcessingLock(true);
    
    // After 1 second delay, process lock
    setTimeout(async () => {
      // Map trait name to traitIndex: 0 = Sal, 1 = pH, 2 = Temp, 3 = Freq
      const traitIndexMap: Record<string, 0 | 1 | 2 | 3> = {
        'Salinity': 0,
        'pH': 1,
        'Temp': 2,
        'Freq': 3,
      };
      
      const traitIndex = traitIndexMap[pendingLockTrait.name];
      if (traitIndex === undefined) {
        console.error('[LockTrait] Invalid trait name:', pendingLockTrait.name);
        setIsProcessingLock(false);
        return;
      }
      
      if (isSimulating) {
        // Update simulated state
        const currentState = getSimulatedCreatureState(tokenId);
        if (currentState) {
          const updatedState = { ...currentState };
          if (pendingLockTrait.name === 'Freq') updatedState.lockedFreq = true;
          else if (pendingLockTrait.name === 'Temp') updatedState.lockedTemp = true;
          else if (pendingLockTrait.name === 'pH') updatedState.lockedPH = true;
          else if (pendingLockTrait.name === 'Salinity') updatedState.lockedSal = true;
          
          // Deduct SP cost: bonded SP first, then global SP
          const lockCost = pendingLockTrait.cost;
          const currentBondedSP = updatedState.bondedSP || 0;
          
          if (currentBondedSP >= lockCost) {
            // Use only bonded SP
            updatedState.bondedSP = currentBondedSP - lockCost;
          } else {
            // Use all bonded SP, then deduct remainder from global SP
            const remainingCost = lockCost - currentBondedSP;
            updatedState.bondedSP = 0;
            
            // Deduct from global SP (localStorage)
            try {
              const currentGlobalSP = parseInt(localStorage.getItem('simulated-wallet-sp') || '0', 10);
              const newGlobalSP = Math.max(0, currentGlobalSP - remainingCost);
              localStorage.setItem('simulated-wallet-sp', newGlobalSP.toString());
              
              // Dispatch event to update SP display
              window.dispatchEvent(new CustomEvent('sp-updated'));
            } catch (err) {
              console.error('[LockTrait] Failed to deduct global SP:', err);
            }
          }
          
          // Calculate lockedCount after update
          const lockedCount = (updatedState.lockedFreq ? 1 : 0) + 
                             (updatedState.lockedTemp ? 1 : 0) + 
                             (updatedState.lockedPH ? 1 : 0) + 
                             (updatedState.lockedSal ? 1 : 0);
          updatedState.lockedCount = lockedCount;
          
          // Check if all 4 traits are now locked (Resonance achieved)
          if (lockedCount === 4) {
            // Store resonance start time if not already set
            if (!updatedState.resonanceStartTime) {
              updatedState.resonanceStartTime = Date.now();
            }
            
            // Move Goob from Lab to Resonance (remove from goobsInLab)
            if (onGoobResonance) {
              onGoobResonance(tokenId);
            }
            
            // Dispatch event to parent to show resonance celebration
            window.dispatchEvent(new CustomEvent('goob-resonance-achieved', { 
              detail: { goobId: tokenId.toString() } 
            }));
          } else {
            // Show regular lock success modal
            setLockedTraitName(pendingLockTrait.name);
            setShowLockSuccessModal(true);
          }
          
          setSimulatedCreatureState(tokenId, updatedState);
          setRefreshKey(prev => prev + 1);
          console.log(`[LockTrait] Locked ${pendingLockTrait.name} in simulation mode`);
        } else {
          // Show regular lock success modal if state not found
          setLockedTraitName(pendingLockTrait.name);
          setShowLockSuccessModal(true);
        }
        
        setIsProcessingLock(false);
        setPendingLockTrait(null);
      } else {
        // Call contract
        try {
          await lockTraitContract(tokenId, traitIndex);
          // Wait for transaction to confirm - success will be handled by useEffect
        } catch (error) {
          console.error('[LockTrait] Failed to lock trait:', error);
          setLockTraitError('Failed to lock trait');
          setIsProcessingLock(false);
          setPendingLockTrait(null);
        }
      }
    }, 1000);
  }, [pendingLockTrait, tokenId, isSimulating, lockTraitContract, totalAvailableSP]);
  
  // Refresh state and show success modal when lock succeeds (real mode)
  React.useEffect(() => {
    if (isLockSuccess && !isSimulating && pendingLockTrait) {
      setRefreshKey(prev => prev + 1);
      
      // Check if all 4 traits are now locked
      const currentState = creatureState;
      if (currentState) {
        const lockedCount = (currentState.lockedFreq ? 1 : 0) + 
                           (currentState.lockedTemp ? 1 : 0) + 
                           (currentState.lockedPH ? 1 : 0) + 
                           (currentState.lockedSal ? 1 : 0);
        
        if (lockedCount === 4) {
          // Move Goob from Lab to Resonance
          if (onGoobResonance) {
            onGoobResonance(tokenId);
          }
          
          // Dispatch event to parent to show resonance celebration
          window.dispatchEvent(new CustomEvent('goob-resonance-achieved', { 
            detail: { goobId: tokenId.toString() } 
          }));
        } else {
          // Show regular lock success modal
          setLockedTraitName(pendingLockTrait.name);
          setShowLockSuccessModal(true);
        }
      } else {
        // Fallback to regular modal if state not available
        setLockedTraitName(pendingLockTrait.name);
        setShowLockSuccessModal(true);
      }
      
      setIsProcessingLock(false);
      setPendingLockTrait(null);
    }
  }, [isLockSuccess, isSimulating, pendingLockTrait, creatureState, tokenId, onGoobResonance]);
  
  // State for vibes animation
  const [showVibesAnimation, setShowVibesAnimation] = React.useState(false);
  
  // Ref to match preview table width to image wrapper
  const imageWrapperRef = React.useRef<HTMLDivElement>(null);
  const [previewTableWidth, setPreviewTableWidth] = React.useState<number | null>(null);
  
  // Listen for animation events from SendVibesButton
  React.useEffect(() => {
    const handleVibesAnimation = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tokenId === tokenId.toString()) {
        setShowVibesAnimation(customEvent.detail.show);
      }
    };
    window.addEventListener('vibes-animation', handleVibesAnimation);
    return () => window.removeEventListener('vibes-animation', handleVibesAnimation);
  }, [tokenId]);
  
  // Match preview table width to image wrapper width
  React.useEffect(() => {
    const updatePreviewWidth = () => {
      if (imageWrapperRef.current) {
        const width = imageWrapperRef.current.offsetWidth;
        setPreviewTableWidth(width);
      }
    };
    
    updatePreviewWidth();
    window.addEventListener('resize', updatePreviewWidth);
    
    // Also update when image loads
    const image = imageWrapperRef.current?.querySelector('img');
    if (image) {
      image.addEventListener('load', updatePreviewWidth);
    }
    
    return () => {
      window.removeEventListener('resize', updatePreviewWidth);
      if (image) {
        image.removeEventListener('load', updatePreviewWidth);
      }
    };
  }, [imageUrl, isLoading]);
  
  // Also check localStorage for animation trigger (fallback)
  React.useEffect(() => {
    const checkAnimation = () => {
      const animKey = `vibes-anim-${tokenId.toString()}`;
      const animTime = localStorage.getItem(animKey);
      if (animTime) {
        const time = parseInt(animTime, 10);
        const now = Date.now();
        if (now - time < 3000) {
          setShowVibesAnimation(true);
          setTimeout(() => {
            setShowVibesAnimation(false);
            localStorage.removeItem(animKey);
          }, 2000);
        }
      }
    };
    checkAnimation();
    const interval = setInterval(checkAnimation, 100);
    return () => clearInterval(interval);
  }, [tokenId]);
  
  // Helper to get vibes color
  const getVibesColor = (vibes: number): string => {
    if (vibes === 0) return '#7f1d1d'; // Deep red
    if (vibes < 5) {
      // 1-4: Gradually lighten from deep red
      const ratio = vibes / 5;
      const r = Math.round(127 + (239 - 127) * ratio);
      const g = Math.round(29 + (68 - 29) * ratio);
      const b = Math.round(29 + (68 - 29) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
    if (vibes < 9) {
      // 5-8: Transition from red to green
      const ratio = (vibes - 5) / 4;
      const r = Math.round(239 - (239 - 16) * ratio);
      const g = Math.round(68 + (185 - 68) * ratio);
      const b = Math.round(68 + (129 - 68) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
    if (vibes === 9) return '#10b981'; // Green
    if (vibes === 10) return '#059669'; // Best green (darker)
    return '#ef4444'; // Default red
  };
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
  const [vibesUpdateKey, setVibesUpdateKey] = React.useState(0);
  
  // Listen for vibes updates
  React.useEffect(() => {
    const handleVibesUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tokenId === tokenId.toString()) {
        setVibesUpdateKey(prev => prev + 1);
      }
    };
    window.addEventListener('vibes-updated', handleVibesUpdate);
    return () => window.removeEventListener('vibes-updated', handleVibesUpdate);
  }, [tokenId]);
  
  const simulatedState = React.useMemo(() => {
    if (isSimulating) {
      return getSimulatedCreatureState(tokenId);
    }
    return null;
  }, [isSimulating, tokenId, refreshKey, vibesUpdateKey]);
  
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
          <div className={styles.expandedImageWrapper} ref={imageWrapperRef}>
            <div 
              className={styles.expandedVibesReadout}
              style={{
                color: isInitialized && displayState ? getVibesColor(displayState.vibes) : 'var(--muted)',
              }}
            >
              Vibes: {isInitialized && displayState ? displayState.vibes : '—'}
            </div>
            {/* Kisses/Hearts Animation */}
            {showVibesAnimation && (
              <>
                <div className={styles.vibesAnimation}>
                  {(() => {
                    // Choose ONE emoji type randomly for ALL animations
                    const emojiType = Math.random() < 0.5 ? '💋' : '❤️';
                    return Array.from({ length: 12 }).map((_, i) => {
                      const randomX = Math.random() * 100;
                      const randomY = Math.random() * 100;
                      const randomDelay = Math.random() * 0.5;
                      return (
                        <span
                          key={i}
                          className={styles.vibesHeart}
                          style={{
                            '--random-x': randomX,
                            '--random-y': randomY,
                            animationDelay: `${randomDelay}s`,
                            left: `${randomX}%`,
                            top: `${randomY}%`,
                          } as React.CSSProperties}
                        >
                          {emojiType}
                        </span>
                      );
                    });
                  })()}
                </div>
                {/* +1 Floating Animation */}
                <div className={styles.plusOneFloat}>
                  +1
                </div>
              </>
            )}
            <img
              src={imageUrl}
              alt={`Goob #${tokenId.toString()}`}
              className={styles.expandedGoobImage}
            />
            
            {/* Lock Trait Buttons - shown when traits are eligible (error < 5% and not locked) */}
            {(() => {
            if (!isInitialized || !displayState) {
              console.log('[LockButton] Not rendering: isInitialized=', isInitialized, 'displayState=', !!displayState);
              return null;
            }
            
            // Calculate lockedCount
            const lockedCount = (displayState.lockedFreq ? 1 : 0) +
                               (displayState.lockedTemp ? 1 : 0) +
                               (displayState.lockedPH ? 1 : 0) +
                               (displayState.lockedSal ? 1 : 0);
            
            // Calculate SP cost based on lockedCount
            const getLockCost = (count: number): number => {
              if (count === 0) return 0;
              else if (count === 1) return 8;
              else if (count === 2) return 10;
              else return 12;
            };
            
            const lockCost = getLockCost(lockedCount);
            
            // Check which traits are eligible (error < 5% and not locked)
            const eligibleTraits: Array<{ name: string; cost: number; error: number }> = [];
            
            const checkTrait = (name: string, current: number, target: number, isLocked: boolean) => {
              if (isLocked) return;
              const error = calculatePercentDifference(current, target);
              console.log(`[LockButton] Checking ${name}: current=${current}, target=${target}, error=${error.toFixed(2)}%, isLocked=${isLocked}`);
              if (error < 5) {
                eligibleTraits.push({ name, cost: lockCost, error });
              }
            };
            
            checkTrait('Freq', displayState.currFreq, displayState.targetFreq, displayState.lockedFreq || false);
            checkTrait('Temp', displayState.currTemp, displayState.targetTemp, displayState.lockedTemp || false);
            checkTrait('pH', displayState.currPH, displayState.targetPH, displayState.lockedPH || false);
            checkTrait('Salinity', displayState.currSal, displayState.targetSal, displayState.lockedSal || false);
            
            console.log(`[LockButton] isInitialized=${isInitialized}, displayState=${!!displayState}, eligibleTraits.length=${eligibleTraits.length}`);
            
            if (eligibleTraits.length === 0) {
              console.log('[LockButton] No eligible traits, returning null');
              return null;
            }
            
            console.log('[LockButton] Rendering buttons for:', eligibleTraits.map(t => t.name).join(', '));
            
            return (
              <>
                {lockTraitError && (
                  <div style={{
                    position: 'absolute',
                    bottom: '180px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '12px 16px 12px 16px',
                    backgroundColor: '#ef4444',
                    border: '2px solid #dc2626',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'center',
                    zIndex: 11,
                    maxWidth: '800px',
                    width: 'calc(100% - 24px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                  }}>
                    <span style={{ fontSize: '16px' }}>⚠️</span>
                    <span style={{ flex: 1 }}>Warning: {lockTraitError}</span>
                    <button
                      onClick={() => setLockTraitError(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '18px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '0 4px',
                        lineHeight: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      aria-label="Dismiss warning"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div style={{ 
                  position: 'absolute',
                  bottom: '140px', // Position well above the trait table (increased from 120px to ensure full clearance)
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px',
                  alignItems: 'center',
                  width: '100%',
                  maxWidth: '800px',
                  padding: '0 12px',
                  zIndex: 10, // Higher z-index to ensure it's above the table
                }}>
                  {eligibleTraits.map((trait) => (
                    <button
                      key={trait.name}
                      onClick={() => {
                        if (isLocking || isProcessingLock) return; // Prevent multiple clicks
                        handleLockTrait(trait.name, trait.cost);
                      }}
                      disabled={isLocking || isProcessingLock}
                      style={{
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#ffffff',
                        backgroundColor: '#10b981', // Solid green background, no transparency
                        border: '2px solid #059669',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minWidth: '200px',
                        opacity: 1, // Ensure no transparency
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#059669';
                        e.currentTarget.style.borderColor = '#047857';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#10b981';
                        e.currentTarget.style.borderColor = '#059669';
                      }}
                    >
                      Lock {trait.name} for {trait.cost} SP?
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
            
            {/* Traits Table - positioned at bottom of image */}
            <div className={styles.expandedTraitsTable}>
          <div className={styles.expandedTraitsHeader}>
            {(() => {
              // Check which traits are eligible for locking (error < 5% and not locked)
              const isEligibleForLock = (traitName: string): boolean => {
                if (!isInitialized || !displayState) return false;
                let current: number, target: number, isLocked: boolean;
                if (traitName === 'Freq') {
                  current = displayState.currFreq;
                  target = displayState.targetFreq;
                  isLocked = displayState.lockedFreq || false;
                } else if (traitName === 'Temp') {
                  current = displayState.currTemp;
                  target = displayState.targetTemp;
                  isLocked = displayState.lockedTemp || false;
                } else if (traitName === 'pH') {
                  current = displayState.currPH;
                  target = displayState.targetPH;
                  isLocked = displayState.lockedPH || false;
                } else if (traitName === 'Salinity') {
                  current = displayState.currSal;
                  target = displayState.targetSal;
                  isLocked = displayState.lockedSal || false;
                } else {
                  return false;
                }
                if (isLocked) return false;
                const error = calculatePercentDifference(current, target);
                return error < 5;
              };
              
              return (
                <>
                  <div className={`${styles.expandedTraitHeader} ${isEligibleForLock('Freq') ? styles.expandedTraitHeaderPulse : ''} ${displayState?.lockedFreq ? styles.expandedTraitHeaderLocked : ''}`}>Freq</div>
                  <div className={`${styles.expandedTraitHeader} ${isEligibleForLock('Temp') ? styles.expandedTraitHeaderPulse : ''} ${displayState?.lockedTemp ? styles.expandedTraitHeaderLocked : ''}`}>Temp</div>
                  <div className={`${styles.expandedTraitHeader} ${isEligibleForLock('pH') ? styles.expandedTraitHeaderPulse : ''} ${displayState?.lockedPH ? styles.expandedTraitHeaderLocked : ''}`}>pH</div>
                  <div className={`${styles.expandedTraitHeader} ${isEligibleForLock('Salinity') ? styles.expandedTraitHeaderPulse : ''} ${displayState?.lockedSal ? styles.expandedTraitHeaderLocked : ''}`}>Salinity</div>
                </>
              );
            })()}
          </div>
          <div className={styles.expandedTraitsRow}>
            <span className={styles.expandedTraitRowLabel}>State</span>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedFreq ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                <>
                  {displayState.currFreq}
                  {displayState.lockedFreq && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedTemp ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                <>
                  {displayState.currTemp}
                  {displayState.lockedTemp && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedPH ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                <>
                  {displayState.currPH}
                  {displayState.lockedPH && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedSal ? styles.expandedTraitCellLocked : ''}`}>
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
            <span className={styles.expandedTraitRowLabel}>Target</span>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedFreq ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                displayState.targetFreq
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedTemp ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                displayState.targetTemp
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedPH ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                displayState.targetPH
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedSal ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                displayState.targetSal
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
          </div>
          <div className={styles.expandedTraitsRow}>
            <span className={styles.expandedTraitRowLabel}>Error</span>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedFreq ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                <span className={getDifferenceColorClass(calculatePercentDifference(displayState.currFreq, displayState.targetFreq))}>
                  {calculatePercentDifference(displayState.currFreq, displayState.targetFreq).toFixed(1)}%
                </span>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedTemp ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                <span className={getDifferenceColorClass(calculatePercentDifference(displayState.currTemp, displayState.targetTemp))}>
                  {calculatePercentDifference(displayState.currTemp, displayState.targetTemp).toFixed(1)}%
                </span>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedPH ? styles.expandedTraitCellLocked : ''}`}>
              {isInitialized && displayState ? (
                <span className={getDifferenceColorClass(calculatePercentDifference(displayState.currPH, displayState.targetPH))}>
                  {calculatePercentDifference(displayState.currPH, displayState.targetPH).toFixed(1)}%
                </span>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={`${styles.expandedTraitCell} ${isInitialized && displayState?.lockedSal ? styles.expandedTraitCellLocked : ''}`}>
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
          <div className={styles.previewTableContainer} style={previewTableWidth ? { width: `${previewTableWidth}px` } : undefined}>
            <div className={styles.previewTable} style={previewTableWidth ? { width: `${previewTableWidth}px` } : undefined}>
              <div className={styles.expandedTraitsRow}>
                <span className={styles.expandedTraitRowLabel}>Net Effect</span>
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
                  {Array.from(selectedItemsForGoob.entries()).flatMap(([itemId, count]) => 
                    // Display each item individually instead of grouping by count
                    Array.from({ length: Number(count) }, (_, index) => (
                      <SelectedItemDisplay 
                        key={`${itemId}-${index}`} 
                        itemId={itemId} 
                        count={1}
                        selectedItemsForGoob={selectedItemsForGoob}
                        setSelectedItemsForGoob={setSelectedItemsForGoob}
                        onRestoreItem={onRestoreItem}
                        goobState={displayState}
                      />
                    ))
                  )}
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
      
      {/* Lock Trait Fake Transaction Modal */}
      {showLockTraitModal && pendingLockTrait && (
        <div 
          className={styles.fakeTransactionOverlay}
          onClick={() => {
            setShowLockTraitModal(false);
            setPendingLockTrait(null);
          }}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className={styles.modalCloseButton}
              onClick={() => {
                setShowLockTraitModal(false);
                setPendingLockTrait(null);
              }}
              aria-label="Close"
            >
              ×
            </button>
            <div className={styles.fakeTransactionText}>
              Lock {pendingLockTrait.name} for {pendingLockTrait.cost} SP?
            </div>
            <button 
              className={styles.fakeTransactionButton}
              onClick={handleFakeLockSign}
            >
              Sign Fake Transaction
            </button>
          </div>
        </div>
      )}
      
      {/* Processing Lock Overlay */}
      {isProcessingLock && (
        <div className={styles.fakeTransactionOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.spinner}></div>
          </div>
        </div>
      )}
      
      {/* Lock Success Modal */}
      {showLockSuccessModal && lockedTraitName && (
        <div 
          className={styles.fakeTransactionOverlay}
          onClick={() => {
            setShowLockSuccessModal(false);
            setLockedTraitName(null);
          }}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className={styles.modalCloseButton}
              onClick={() => {
                setShowLockSuccessModal(false);
                setLockedTraitName(null);
              }}
              aria-label="Close"
            >
              ×
            </button>
            <div className={styles.fakeTransactionText}>
              {lockedTraitName} successfully locked
            </div>
            <button 
              className={styles.fakeTransactionButton}
              onClick={() => {
                setShowLockSuccessModal(false);
                setLockedTraitName(null);
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Resonance Achievement Modal */}
      {showResonanceModal && (
        <div 
          className={styles.fakeTransactionOverlay}
          onClick={() => {
            setShowResonanceModal(false);
          }}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className={styles.modalCloseButton}
              onClick={() => {
                setShowResonanceModal(false);
              }}
              aria-label="Close"
            >
              ×
            </button>
            <div className={styles.fakeTransactionText} style={{ fontSize: '24px', fontWeight: 700, color: '#fbbf24', marginBottom: '16px' }}>
              Goob Has achieved Resonance!
            </div>
            <div className={styles.fakeTransactionText} style={{ fontSize: '14px', marginBottom: '20px' }}>
              All 4 traits are locked. Your Goob has entered the Resonance Phase.
            </div>
            <button 
              className={styles.fakeTransactionButton}
              onClick={() => {
                setShowResonanceModal(false);
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Resonance Confetti */}
      {showResonanceConfetti && <ConfettiEffect />}
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
  isSimulating?: boolean;
  onSelect: () => void;
  onSelectForBatch: (e: React.MouseEvent) => void;
  isInResonance?: boolean;
}> = ({ tokenId, isSelected, isSelectedForBatch, showPlusButton, isWaitingRoom, isSimulating = false, onSelect, onSelectForBatch, isInResonance = false }) => {
  const { metadata, isLoading } = useGoobMetadata(tokenId);
  const { state: creatureState } = useCreatureState(Number(tokenId));
  
  // Get simulated state if in simulation mode
  const simulatedState = isSimulating ? getSimulatedCreatureState(tokenId) : null;
  
  // Use simulated state if available, otherwise use on-chain state
  const displayState = simulatedState || creatureState;
  
  // Calculate resonance countdown (7 days from start time)
  const [resonanceTimeRemaining, setResonanceTimeRemaining] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!isInResonance || !displayState) return;
    
    const resonanceStartTime = (displayState as any).resonanceStartTime;
    if (!resonanceStartTime) return;
    
    const calculateTimeRemaining = () => {
      const now = Date.now();
      const elapsed = now - resonanceStartTime;
      const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      const remaining = sevenDays - elapsed;
      return remaining > 0 ? remaining : 0;
    };
    
    const updateTime = () => {
      setResonanceTimeRemaining(calculateTimeRemaining());
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, [isInResonance, displayState]);
  
  const formatResonanceTime = (ms: number): string => {
    if (ms <= 0) return 'Ready';
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  // Get image URL (prefer image_data for on-chain, fallback to image)
  const imageUrl = metadata?.image_data || metadata?.image || null;
  
  // Helper to get vibes color
  const getVibesColor = (vibes: number): string => {
    if (vibes === 0) return '#7f1d1d'; // Deep red
    if (vibes < 5) {
      // 1-4: Gradually lighten from deep red
      const ratio = vibes / 5;
      const r = Math.round(127 + (239 - 127) * ratio);
      const g = Math.round(29 + (68 - 29) * ratio);
      const b = Math.round(29 + (68 - 29) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
    if (vibes < 9) {
      // 5-8: Transition from red to green
      const ratio = (vibes - 5) / 4;
      const r = Math.round(239 - (239 - 16) * ratio);
      const g = Math.round(68 + (185 - 68) * ratio);
      const b = Math.round(68 + (129 - 68) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
    if (vibes === 9) return '#10b981'; // Green
    if (vibes === 10) return '#059669'; // Best green (darker)
    return '#ef4444'; // Default red
  };

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
      {/* Resonance Countdown - show above card if in resonance */}
      {isInResonance && resonanceTimeRemaining !== null && (
        <div 
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: '10px',
            fontWeight: 600,
            color: '#fbbf24',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            padding: '4px 8px',
            borderRadius: '4px 4px 0 0',
            marginBottom: '4px',
          }}
        >
          Resonance: {formatResonanceTime(resonanceTimeRemaining)}
        </div>
      )}
      
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
        {/* Vibes Counter - only show in Lab or Resonance view */}
        {!isWaitingRoom && displayState && typeof displayState.vibes === 'number' && (
          <div 
            style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              fontSize: '11px',
              fontWeight: 600,
              color: getVibesColor(displayState.vibes),
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '2px 6px',
              borderRadius: '4px',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            Vibes: {displayState.vibes}
          </div>
        )}
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
}> = ({ itemId, count: _count, selectedItemsForGoob: _selectedItemsForGoob, setSelectedItemsForGoob, onRestoreItem, goobState }) => {
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
        {/* Quantity counter removed - items are now displayed individually */}
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

