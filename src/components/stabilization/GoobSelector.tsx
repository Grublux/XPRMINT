// src/components/stabilization/GoobSelector.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useUserGoobs } from '../../hooks/goobs/useUserGoobs';
import { useSimulatedGoobs } from '../../hooks/goobs/useSimulatedGoobs';
import { useGoobMetadata } from '../../hooks/goobs/useGoobMetadata';
import { useCreatureState } from '../../hooks/stabilizationV3/useCreatureState';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
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
  
  // Initialize goobsInLab from localStorage for persistence
  // Try ALL possible storage keys to find existing data
  const [goobsInLab, setGoobsInLab] = useState<Set<string>>(() => {
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
      // Move selected Goobs to "In Lab" and clear selection
      setGoobsInLab(prev => {
        const next = new Set(prev);
        selectedGoobIds.forEach(id => next.add(id.toString()));
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

// Expanded Goob view component
const ExpandedGoobView: React.FC<{
  tokenId: bigint;
  onClose: () => void;
  selectedItemsForGoob?: Map<number, number>;
  setSelectedItemsForGoob?: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onRestoreItem?: (itemId: number) => void;
}> = ({ tokenId, onClose, selectedItemsForGoob = new Map(), setSelectedItemsForGoob, onRestoreItem }) => {
  const { metadata, isLoading } = useGoobMetadata(tokenId);
  const { state: creatureState } = useCreatureState(Number(tokenId));
  const imageUrl = metadata?.image_data || metadata?.image || null;
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [desktopTargetIndex, setDesktopTargetIndex] = useState<number | null>(null);
  const lastDesktopTargetIndexRef = useRef<number | null>(null);

  const isInitialized = creatureState !== null && 
    !(creatureState.targetSal === 0 && creatureState.targetPH === 0 && 
      creatureState.targetTemp === 0 && creatureState.targetFreq === 0);
  
  // Update highlight to show where dragged item currently is (after reordering)
  useEffect(() => {
    if (draggedItemId !== null) {
      const entries = Array.from(selectedItemsForGoob.entries());
      const index = entries.findIndex(([id]) => id === draggedItemId);
      if (index >= 0) {
        setHighlightedIndex(index);
      }
    } else {
      setHighlightedIndex(null);
    }
  }, [selectedItemsForGoob, draggedItemId]);
  
  // Track target during drag (same as touch - no live reordering, just highlight)
  // Note: The actual target tracking happens in SelectedItemDisplay's onDragOver handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    
    // Just track which item we're over - don't swap yet (same as touch behavior)
    // The swap will happen in handleDragEnd in SelectedItemDisplay
  };

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
              Vibes: {isInitialized && creatureState ? creatureState.vibes : '—'}
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
            <span className={styles.expandedTraitRowLabel}>Current</span>
            <div className={styles.expandedTraitCell}>
              {isInitialized && creatureState ? (
                <>
                  {creatureState.currFreq}
                  {creatureState.lockedFreq && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && creatureState ? (
                <>
                  {creatureState.currTemp}
                  {creatureState.lockedTemp && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && creatureState ? (
                <>
                  {creatureState.currPH}
                  {creatureState.lockedPH && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && creatureState ? (
                <>
                  {creatureState.currSal}
                  {creatureState.lockedSal && <span className={styles.lockedBadge}> LOCKED</span>}
                </>
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
          </div>
          <div className={styles.expandedTraitsRow}>
            <span className={styles.expandedTraitRowLabel}>Target</span>
            <div className={styles.expandedTraitCell}>
              {isInitialized && creatureState ? (
                creatureState.targetFreq
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && creatureState ? (
                creatureState.targetTemp
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && creatureState ? (
                creatureState.targetPH
              ) : (
                <span className={styles.expandedTraitEmpty}>—</span>
              )}
            </div>
            <div className={styles.expandedTraitCell}>
              {isInitialized && creatureState ? (
                creatureState.targetSal
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
        
        {/* Items instruction container */}
        {imageUrl && !isLoading && (
          <div className={styles.expandedItemsInstruction}>
            {selectedItemsForGoob.size > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textAlign: 'center' }}>
                  Drag Items in order to preview effects
                </div>
                <div 
                  className={styles.selectedItemsGrid}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                >
                  {Array.from(selectedItemsForGoob.entries()).map(([itemId, count], index) => (
                    <SelectedItemDisplay 
                      key={itemId} 
                      itemId={itemId} 
                      count={count}
                      index={index}
                      selectedItemsForGoob={selectedItemsForGoob}
                      setSelectedItemsForGoob={setSelectedItemsForGoob}
                      onRestoreItem={onRestoreItem}
                      draggedItemId={draggedItemId}
                      highlightedIndex={highlightedIndex}
                      desktopTargetIndex={desktopTargetIndex}
                      setDesktopTargetIndex={setDesktopTargetIndex}
                      lastDesktopTargetIndexRef={lastDesktopTargetIndexRef}
                      onDragStart={() => setDraggedItemId(itemId)}
                      onDragEnd={() => {
                        setDraggedItemId(null);
                        setHighlightedIndex(null);
                        setDesktopTargetIndex(null);
                        lastDesktopTargetIndexRef.current = null;
                      }}
                      onDragOver={handleDragOver}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div>Choose up to 3 items below to apply to Goob</div>
            )}
          </div>
        )}
      </div>
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
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }, 150);
        } else if (isSelectedForBatch) {
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
  index: number;
  selectedItemsForGoob?: Map<number, number>;
  setSelectedItemsForGoob?: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onRestoreItem?: (itemId: number) => void;
  draggedItemId?: number | null;
  highlightedIndex?: number | null;
  desktopTargetIndex?: number | null;
  setDesktopTargetIndex?: React.Dispatch<React.SetStateAction<number | null>>;
  lastDesktopTargetIndexRef?: React.MutableRefObject<number | null>;
  onDragStart?: (itemId: number) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent, targetIndex: number) => void;
}> = ({ itemId, count, index, selectedItemsForGoob, setSelectedItemsForGoob, onRestoreItem, draggedItemId, highlightedIndex, desktopTargetIndex, setDesktopTargetIndex, lastDesktopTargetIndexRef, onDragStart, onDragEnd, onDragOver }) => {
  const { metadata, isLoading } = useItemMetadata(itemId);
  const imageUrl = metadata?.image || metadata?.image_data || null;
  const [isDragging, setIsDragging] = useState(false);
  const [touchTargetIndex, setTouchTargetIndex] = useState<number | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const isDraggingRef = useRef(false);
  const initialTouchRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const lastTargetIndexRef = useRef<number | null>(null);
  
  const isBeingDragged = draggedItemId === itemId;
  const isHighlighted = highlightedIndex === index && draggedItemId !== null;
  // For touch: highlight if this is the target item we're hovering over
  const isTouchTarget = touchTargetIndex === index && draggedItemId !== null && draggedItemId !== itemId;
  // For desktop: highlight if this is the target item we're hovering over
  const isDesktopTarget = desktopTargetIndex === index && draggedItemId !== null && draggedItemId !== itemId;
  
  // Desktop drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    isDraggingRef.current = true;
    if (lastDesktopTargetIndexRef) {
      lastDesktopTargetIndexRef.current = null;
    }
    if (setDesktopTargetIndex) {
      setDesktopTargetIndex(null);
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId.toString());
    e.dataTransfer.setData('application/index', index.toString());
    if (onDragStart) {
      onDragStart(itemId);
    }
    if (e.dataTransfer.setDragImage && itemRef.current) {
      const dragImage = itemRef.current.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = '0.5';
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, e.clientX - itemRef.current.getBoundingClientRect().left, e.clientY - itemRef.current.getBoundingClientRect().top);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };
  
  const handleDragEnd = (e: React.DragEvent) => {
    // Use the stored target index from onDragOver (highlighting confirms this is working)
    const finalTargetIndex = lastDesktopTargetIndexRef?.current ?? null;
    
    // Perform the swap if we were over a valid target
    if (finalTargetIndex !== null && setSelectedItemsForGoob && draggedItemId) {
      // Disable transitions during swap to prevent flicker
      setIsSwapping(true);
      
      setSelectedItemsForGoob(prev => {
        const entries = Array.from(prev.entries());
        const currentDraggedIndex = entries.findIndex(([id]) => id === draggedItemId);
        
        // Swap if we have valid indices and they're different
        if (currentDraggedIndex !== -1 && finalTargetIndex !== null && currentDraggedIndex !== finalTargetIndex && finalTargetIndex < entries.length) {
          // Direct swap: swap the dragged item with the item at the target position
          const draggedEntry = entries[currentDraggedIndex];
          const targetEntry = entries[finalTargetIndex];
          
          // Swap them
          entries[currentDraggedIndex] = targetEntry;
          entries[finalTargetIndex] = draggedEntry;
          
          return new Map(entries);
        }
        
        return prev;
      });
      
      // Reset visual state after swap completes
      requestAnimationFrame(() => {
        setIsDragging(false);
        isDraggingRef.current = false;
        // Re-enable transitions after a brief delay
        setTimeout(() => {
          setIsSwapping(false);
        }, 50);
      });
    } else {
      // No swap - reset immediately
      setIsDragging(false);
      isDraggingRef.current = false;
    }
    
    // Check if dropped outside the selected items grid
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    const selectedItemsGrid = document.querySelector(`.${styles.selectedItemsGrid}`);
    if (!selectedItemsGrid || !selectedItemsGrid.contains(dropTarget)) {
      // Remove item from selected items
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
    }
    
    if (lastDesktopTargetIndexRef) {
      lastDesktopTargetIndexRef.current = null;
    }
    if (setDesktopTargetIndex) {
      setDesktopTargetIndex(null);
    }
    
    if (onDragEnd) {
      onDragEnd();
    }
  };
  
  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      // Store the initial touch position relative to the viewport
      initialTouchRef.current = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        startX: touch.clientX,
        startY: touch.clientY
      };
    }
    setIsDragging(true);
    isDraggingRef.current = true;
    lastTargetIndexRef.current = null;
    setTouchTargetIndex(null);
    if (onDragStart) {
      onDragStart(itemId);
    }
    e.preventDefault(); // Prevent scrolling while dragging
    e.stopPropagation();
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !initialTouchRef.current || !itemRef.current) return;
    e.preventDefault(); // Prevent scrolling while dragging
    e.stopPropagation();
    const touch = e.touches[0];
    
    // Calculate offset from initial touch position
    const offsetX = touch.clientX - initialTouchRef.current.startX;
    const offsetY = touch.clientY - initialTouchRef.current.startY;
    
    itemRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    itemRef.current.style.opacity = '0.5';
    itemRef.current.style.zIndex = '1000';
    itemRef.current.style.pointerEvents = 'none'; // Allow clicks to pass through to items below
    
    // Temporarily hide this item to detect what's underneath
    const originalDisplay = itemRef.current.style.display;
    const originalVisibility = itemRef.current.style.visibility;
    itemRef.current.style.display = 'none';
    itemRef.current.style.visibility = 'hidden';
    
    // Check if we're over another item for reordering
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    
    // Restore visibility
    itemRef.current.style.display = originalDisplay;
    itemRef.current.style.visibility = originalVisibility;
    
    // Just track which item we're over - don't swap yet
    if (elementBelow && selectedItemsForGoob) {
      const targetItem = elementBelow.closest(`[data-item-id]`) as HTMLElement;
      if (targetItem && targetItem !== itemRef.current) {
        const targetItemId = parseInt(targetItem.getAttribute('data-item-id') || '0', 10);
        const entries = Array.from(selectedItemsForGoob.entries());
        const targetIndex = entries.findIndex(([id]) => id === targetItemId);
        
        if (targetIndex !== -1) {
          lastTargetIndexRef.current = targetIndex;
          setTouchTargetIndex(targetIndex);
        } else {
          lastTargetIndexRef.current = null;
          setTouchTargetIndex(null);
        }
      } else {
        lastTargetIndexRef.current = null;
        setTouchTargetIndex(null);
      }
    } else {
      lastTargetIndexRef.current = null;
      setTouchTargetIndex(null);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    
    // IMMEDIATELY reset visual state to prevent items sticking
    if (itemRef.current) {
      itemRef.current.style.pointerEvents = '';
      itemRef.current.style.transform = '';
      itemRef.current.style.opacity = '';
      itemRef.current.style.zIndex = '';
    }
    
    setIsDragging(false);
    isDraggingRef.current = false;
    
    const touch = e.changedTouches[0];
    
    // Re-detect the target item at drop time to ensure we have the correct target
    const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
    let finalTargetIndex: number | null = null;
    
    if (dropTarget && selectedItemsForGoob) {
      const targetItem = dropTarget.closest(`[data-item-id]`) as HTMLElement;
      if (targetItem && targetItem !== itemRef.current) {
        const targetItemId = parseInt(targetItem.getAttribute('data-item-id') || '0', 10);
        const entries = Array.from(selectedItemsForGoob.entries());
        const detectedIndex = entries.findIndex(([id]) => id === targetItemId);
        if (detectedIndex !== -1) {
          finalTargetIndex = detectedIndex;
        }
      }
    }
    
    // Fall back to stored target index if detection failed
    if (finalTargetIndex === null) {
      finalTargetIndex = lastTargetIndexRef.current;
    }
    
    // Perform the swap if we were over a valid target
    if (finalTargetIndex !== null && setSelectedItemsForGoob && draggedItemId) {
      setSelectedItemsForGoob(prev => {
        const entries = Array.from(prev.entries());
        const currentDraggedIndex = entries.findIndex(([id]) => id === draggedItemId);
        
        if (currentDraggedIndex !== -1 && currentDraggedIndex !== finalTargetIndex && finalTargetIndex !== null && finalTargetIndex < entries.length) {
          // Direct swap: swap the dragged item with the item at the target position
          const draggedEntry = entries[currentDraggedIndex];
          const targetEntry = entries[finalTargetIndex];
          
          // Swap them
          entries[currentDraggedIndex] = targetEntry;
          entries[finalTargetIndex] = draggedEntry;
          
          return new Map(entries);
        }
        
        return prev;
      });
    }
    
    // Check if dropped outside the selected items grid (reuse dropTarget from above)
    const selectedItemsGrid = document.querySelector(`.${styles.selectedItemsGrid}`);
    if (!selectedItemsGrid || !selectedItemsGrid.contains(dropTarget)) {
      // Remove item from selected items
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
    }
    
    initialTouchRef.current = null;
    lastTargetIndexRef.current = null;
    setTouchTargetIndex(null);
    
    if (onDragEnd) {
      onDragEnd();
    }
  };
  
  return (
    <div 
      ref={itemRef}
      draggable
      data-item-id={itemId}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        // Track this item as the target when drag is over it
        if (draggedItemId !== null && draggedItemId !== itemId) {
          if (lastDesktopTargetIndexRef) {
            lastDesktopTargetIndexRef.current = index;
          }
          if (setDesktopTargetIndex) {
            setDesktopTargetIndex(index);
          }
        }
        // Also call parent's onDragOver if provided
        if (onDragOver) {
          onDragOver(e, index);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
      background: (isHighlighted || isTouchTarget || isDesktopTarget) ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
      cursor: isDragging ? 'grabbing' : 'grab',
      width: '132px',
      flexShrink: 0,
      minHeight: '132px',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '4px',
      border: (isHighlighted || isTouchTarget || isDesktopTarget) ? '2px dashed rgba(16, 185, 129, 0.8)' : isBeingDragged ? '2px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
      overflow: 'visible',
      transition: (isBeingDragged || isSwapping) ? 'none' : 'opacity 0.15s ease',
      margin: '0',
      padding: '0',
      boxSizing: 'border-box',
      position: 'relative',
      opacity: isBeingDragged ? 0.5 : 1,
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
      </div>
    </div>
  );
};

