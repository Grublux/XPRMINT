// src/components/stabilization/ItemSelector.tsx

import React, { useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useWalletItemsSummary } from '../../hooks/stabilizationV3/useWalletItemsSummary';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
import { useCreatureState } from '../../hooks/stabilizationV3/useCreatureState';
import { ITEM_V3_ADDRESS, itemToken1155V3Abi } from '../../config/contracts/stabilizationV3';
import styles from './ItemSelector.module.css';

type FilterCategory = 'All' | 'Freq' | 'Temp' | 'pH' | 'Salinity' | 'Epic';

type ItemSelectorProps = {
  creatureId?: bigint | number | null;
  isSimulating?: boolean;
  selectedItemsForGoob?: Map<number, number>;
  setSelectedItemsForGoob?: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onRestoreItem?: (itemId: number) => void;
  simulationItems?: Map<number, bigint>; // itemId -> balance for simulation mode
  setSimulationItems?: React.Dispatch<React.SetStateAction<Map<number, bigint>>>; // Update simulation items
  isWhitelisted?: boolean;
};

export type ItemSelectorRef = {
  restoreItem: (itemId: number) => void;
};

export const ItemSelector = forwardRef<ItemSelectorRef, ItemSelectorProps>(({
  creatureId, 
  isSimulating = false,
  selectedItemsForGoob: externalSelectedItems,
  setSelectedItemsForGoob: externalSetSelectedItems,
  onRestoreItem: externalOnRestoreItem,
  simulationItems = new Map(),
  setSimulationItems: externalSetSimulationItems,
  isWhitelisted = false,
}, ref) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { items: walletItems, isLoading: walletIsLoading, isError } = useWalletItemsSummary();
  
  // For whitelisted wallets during early testing: only use simulation mode
  // Don't load real items when whitelisted and not simulating
  const shouldUseSimulation = isWhitelisted && !isSimulating;
  
  // In simulation mode, convert simulationItems Map to items array format
  const simulationItemsArray = React.useMemo(() => {
    if (!isSimulating) return [];
    return Array.from(simulationItems.entries()).map(([id, balance]) => ({
      id,
      balance,
    }));
  }, [isSimulating, simulationItems]);
  
  // In simulation mode, use simulation items, otherwise use wallet items (unless whitelisted)
  const items = isSimulating ? simulationItemsArray : (shouldUseSimulation ? [] : walletItems);
  const isLoading = isSimulating ? false : (shouldUseSimulation ? false : walletIsLoading);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('Freq');
  const [hasInitializedFilter, setHasInitializedFilter] = useState(false);
  const [recalculateTrigger, setRecalculateTrigger] = useState(0);
  
  // Use external state if provided, otherwise use local state
  const [localSelectedItems, setLocalSelectedItems] = useState<Map<number, number>>(new Map());
  const selectedItemsForGoob = externalSelectedItems ?? localSelectedItems;
  const setSelectedItemsForGoob = externalSetSelectedItems ?? setLocalSelectedItems;
  
  // Track item balances (decremented when items are added to Goob)
  const [itemBalances, setItemBalances] = useState<Map<number, bigint>>(new Map());
  
  // Initialize balances from items
  React.useEffect(() => {
    const balances = new Map<number, bigint>();
    items.forEach(item => {
      balances.set(item.id, item.balance);
    });
    setItemBalances(balances);
  }, [items]);
  
  // Preload metadata for all items to ensure category counts are accurate
  React.useEffect(() => {
    if (!publicClient || items.length === 0) return;
    
    const prefetchPromises: Promise<any>[] = [];
    
    // Prefetch metadata for all items (React Query will cache it)
    items.forEach(item => {
      const queryKey = ['item-metadata', ITEM_V3_ADDRESS, item.id.toString()];
      const cached = queryClient.getQueryData(queryKey);
      
      // Only prefetch if not already cached
      if (!cached) {
        const prefetchPromise = queryClient.prefetchQuery({
          queryKey,
          queryFn: async () => {
            try {
              const tokenURI = await publicClient.readContract({
                address: ITEM_V3_ADDRESS,
                abi: itemToken1155V3Abi,
                functionName: 'uri',
                args: [BigInt(item.id)],
              }) as string;

              if (!tokenURI || tokenURI === '') return null;

              let jsonString: string;
              if (tokenURI.startsWith('data:application/json;base64,')) {
                const base64 = tokenURI.replace('data:application/json;base64,', '');
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                jsonString = new TextDecoder('utf-8').decode(bytes);
              } else if (tokenURI.startsWith('data:application/json,')) {
                jsonString = decodeURIComponent(tokenURI.replace('data:application/json,', ''));
              } else if (tokenURI.startsWith('http://') || tokenURI.startsWith('https://')) {
                const response = await fetch(tokenURI);
                if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
                jsonString = await response.text();
              } else {
                jsonString = tokenURI;
              }

              const metadata = JSON.parse(jsonString);
              
              // Cache in localStorage too
              try {
                const key = `item-metadata-${ITEM_V3_ADDRESS}-${item.id}`;
                window.localStorage.setItem(key, JSON.stringify(metadata));
              } catch {}
              
              return metadata;
            } catch (err) {
              return null;
            }
          },
          staleTime: 5 * 60 * 1000,
        });
        prefetchPromises.push(prefetchPromise);
      }
    });
    
    // After all prefetches complete (or immediately if none needed), trigger recalculation
    if (prefetchPromises.length > 0) {
      Promise.allSettled(prefetchPromises).then(() => {
        setTimeout(() => {
          setRecalculateTrigger(prev => prev + 1);
        }, 500);
      });
    } else {
      // All items already cached, trigger recalculation immediately
      setTimeout(() => {
        setRecalculateTrigger(prev => prev + 1);
      }, 100);
    }
  }, [items, publicClient, queryClient]);
  
  // Create restore callback
  const handleRestoreItem = React.useCallback((itemId: number) => {
    // Increment balance when item is restored
    setItemBalances(prev => {
      const next = new Map(prev);
      const currentBalance = next.get(itemId) ?? 0n;
      next.set(itemId, currentBalance + 1n);
      return next;
    });
    
    // In simulation mode, also update simulationItems in parent
    if (isSimulating && externalSetSimulationItems) {
      externalSetSimulationItems(prev => {
        const next = new Map(prev);
        const currentBalance = next.get(itemId) ?? 0n;
        next.set(itemId, currentBalance + 1n);
        return next;
      });
    }
    
    // Call external callback if provided
    if (externalOnRestoreItem) {
      externalOnRestoreItem(itemId);
    }
  }, [externalOnRestoreItem, isSimulating, externalSetSimulationItems]);
  
  // Expose restore function via ref
  useImperativeHandle(ref, () => ({
    restoreItem: handleRestoreItem,
  }));
  
  // Auto-select first available category if Freq has no items
  React.useEffect(() => {
    if (isLoading || !items.length || hasInitializedFilter) return;
    
    // Helper to get category from cached metadata
    const getCategoryFromCachedMetadata = (itemId: number): FilterCategory | null => {
      try {
        const cached = localStorage.getItem(`item-metadata-${ITEM_V3_ADDRESS}-${itemId}`);
        if (cached) {
          const metadata = JSON.parse(cached);
          if (metadata?.attributes) {
            for (const attr of metadata.attributes) {
              if (attr.trait_type === 'Rarity') {
                const value = String(attr.value).toLowerCase();
                if (value === 'epic') return 'Epic';
              }
              if (attr.trait_type === 'Primary Trait') {
                const value = String(attr.value).toLowerCase();
                if (value.includes('frequency')) return 'Freq';
                if (value.includes('temperature')) return 'Temp';
                if (value.includes('ph') || value === 'ph') return 'pH';
                if (value.includes('salinity')) return 'Salinity';
              }
            }
          }
        }
      } catch {}
      return null;
    };
    
    // Check which categories have items (only from cached metadata)
    const categoriesWithItems = new Set<FilterCategory>();
    let hasAnyCachedMetadata = false;
    
    items.forEach(item => {
      const balance = itemBalances.get(item.id) ?? item.balance;
      if (balance > 0n) {
        const category = getCategoryFromCachedMetadata(item.id);
        if (category) {
          categoriesWithItems.add(category);
          hasAnyCachedMetadata = true;
        }
      }
    });
    
    // If we have cached metadata and Freq has no items, find the first available category
    if (hasAnyCachedMetadata && !categoriesWithItems.has('Freq')) {
      const categoryOrder: FilterCategory[] = ['Freq', 'Temp', 'pH', 'Salinity', 'Epic', 'All'];
      for (const category of categoryOrder) {
        if (categoriesWithItems.has(category) || category === 'All') {
          setSelectedFilter(category);
          setHasInitializedFilter(true);
          return;
        }
      }
    }
    
    // If no cached metadata yet, wait a bit and try again, or just use 'All' as fallback
    if (!hasAnyCachedMetadata) {
      const timeout = setTimeout(() => {
        // Try one more time after a short delay
        setHasInitializedFilter(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
    
    setHasInitializedFilter(true);
  }, [items, itemBalances, isLoading, hasInitializedFilter]);
  
  // Calculate item counts per category (must be before early returns)
  const categoryCounts = React.useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      'Freq': 0,
      'Temp': 0,
      'pH': 0,
      'Salinity': 0,
      'Epic': 0,
      'All': 0,
    };

    // Helper to get category from cached metadata (checks both localStorage and React Query cache)
    const getCategoryFromCachedMetadata = (itemId: number): FilterCategory | null => {
      let metadata: any = null;
      
      // First, try React Query cache
      try {
        const queryKey = ['item-metadata', ITEM_V3_ADDRESS, itemId.toString()];
        const cachedData = queryClient.getQueryData(queryKey);
        if (cachedData) {
          metadata = cachedData;
        }
      } catch (e) {
        // Query cache access failed, continue to localStorage
      }
      
      // If not in React Query cache, try localStorage
      if (!metadata && typeof window !== 'undefined') {
        let localStorage: Storage | null = null;
        try {
          localStorage = window.localStorage;
          if (localStorage) {
            const key = `item-metadata-${ITEM_V3_ADDRESS}-${itemId}`;
            let cached: string | null = null;
            try {
              cached = localStorage.getItem(key);
            } catch (e) {
              // localStorage.getItem() can throw in some browsers
            }
            
            if (cached && cached.trim() !== '') {
              try {
                metadata = JSON.parse(cached);
              } catch (e) {
                // Invalid JSON
              }
            }
          }
        } catch (e) {
          // localStorage not available (private browsing, etc.)
        }
      }
      
      // Extract category from metadata
      if (metadata && typeof metadata === 'object' && metadata.attributes && Array.isArray(metadata.attributes)) {
        // First pass: check for Epic (highest priority)
        for (const attr of metadata.attributes) {
          if (attr && typeof attr === 'object' && attr.trait_type && attr.value !== undefined) {
            if (attr.trait_type === 'Rarity') {
              const value = String(attr.value).toLowerCase().trim();
              if (value === 'epic') return 'Epic';
            }
          }
        }
        
        // Second pass: check for Primary Trait (if not Epic)
        for (const attr of metadata.attributes) {
          if (attr && typeof attr === 'object' && attr.trait_type && attr.value !== undefined) {
            if (attr.trait_type === 'Primary Trait') {
              const value = String(attr.value).toLowerCase().trim();
              if (value.includes('frequency')) return 'Freq';
              if (value.includes('temperature')) return 'Temp';
              if (value.includes('ph') || value === 'ph') return 'pH';
              if (value.includes('salinity')) return 'Salinity';
            }
          }
        }
      }
      
      return null;
    };

    items.forEach(item => {
      const balance = itemBalances.get(item.id) ?? item.balance;
      if (balance > 0n) {
        const balanceNum = Number(balance);
        const category = getCategoryFromCachedMetadata(item.id);
        if (category) {
          // Add balance to the specific category
          counts[category] = (counts[category] || 0) + balanceNum;
        }
        // Always add to 'All' regardless of category detection
        counts['All'] = (counts['All'] || 0) + balanceNum;
      }
    });

    return counts;
  }, [items, itemBalances, queryClient, recalculateTrigger]);
  
  // Validate category counts: sum of individual categories should equal "All"
  // If mismatch, trigger a rescan after a delay
  React.useEffect(() => {
    const allCount = categoryCounts['All'];
    if (allCount === 0) return; // No items yet
    
    const categorySum = categoryCounts['Freq'] + 
                        categoryCounts['Temp'] + 
                        categoryCounts['pH'] + 
                        categoryCounts['Salinity'] + 
                        categoryCounts['Epic'];
    
    // If sum doesn't match "All", metadata might not be loaded yet - trigger rescan
    if (categorySum !== allCount) {
      const timeout = setTimeout(() => {
        setRecalculateTrigger(prev => prev + 1);
      }, 1000); // Wait 1 second for metadata to load, then rescan
      
      return () => clearTimeout(timeout);
    }
  }, [categoryCounts]);
  
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 items-center text-center w-full">
        <div className="text-sm text-muted-foreground">Loading items...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-red-400 text-center">
        Unable to load items. Check console for details.
      </div>
    );
  }


  if (!items.length) {
    if (address) {
      // Connected wallet with no items
      return (
        <div className={styles.noItemsContainer}>
          <div className={styles.noItemsMessage}>
            You have no items, Choose a Goob to claim a starter pack or head to{' '}
            <a 
              href="https://magiceden.us/collections/apechain/ITEMS"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.magicEdenLink}
            >
              Magic Eden
            </a>
            {' '}to buy on secondary
          </div>
        </div>
      );
    }
    // Not connected - show generic message
    return (
      <div className="flex flex-col gap-2 items-center text-center w-full">
        <div className="text-sm text-muted-foreground">
          You have no items. Select Goobs above to claim starter packs.
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '20px', width: '100%' }}>
      {/* Filter Buttons - hidden when item is expanded */}
      {!expandedItemId && (
          <div className={styles.filterContainer}>
            {(['Freq', 'Temp', 'pH', 'Salinity', 'Epic', 'All'] as FilterCategory[]).map((category) => (
              <button
                key={category}
                className={`${styles.filterButton} ${selectedFilter === category ? styles.filterButtonActive : ''}`}
                onClick={() => setSelectedFilter(category)}
              >
                <div>{category}</div>
                <div className={styles.filterButtonQty}>{categoryCounts[category] || 0}</div>
              </button>
            ))}
          </div>
      )}
      
      {/* Helper text - only in Lab view (when creatureId is set), hide when items are selected */}
      {!expandedItemId && creatureId && selectedItemsForGoob.size === 0 && (
        <div className={styles.itemsHelperText}>
          Click to expand or hit "+" to add
        </div>
      )}
      
      {expandedItemId ? (
        <ExpandedItemView
          itemId={expandedItemId}
          balance={items.find(i => i.id === expandedItemId)?.balance || 0n}
          onClose={() => setExpandedItemId(null)}
          creatureId={creatureId}
        />
      ) : (
        <div className={styles.itemGrid}>
          {items
            .filter(item => {
              // Filter out items with 0 balance
              const balance = itemBalances.get(item.id) ?? item.balance;
              return balance > 0n;
            })
            .sort((a, b) => {
              // Helper to get primary delta magnitude from cached metadata
              const getMagnitude = (itemId: number): number => {
                try {
                  const cached = localStorage.getItem(`item-metadata-${ITEM_V3_ADDRESS}-${itemId}`);
                  if (cached) {
                    const metadata = JSON.parse(cached);
                    if (metadata?.attributes) {
                      for (const attr of metadata.attributes) {
                        if (attr.trait_type === 'Primary Delta Magnitude') {
                          const value = typeof attr.value === 'number' ? attr.value : parseInt(String(attr.value), 10);
                          return isNaN(value) ? Infinity : Math.abs(value);
                        }
                      }
                    }
                  }
                } catch {}
                return Infinity; // Items without metadata go to the end
              };
              
              const magnitudeA = getMagnitude(a.id);
              const magnitudeB = getMagnitude(b.id);
              
              // Sort by magnitude (lowest first)
              return magnitudeA - magnitudeB;
            })
            .map((item) => {
              const balance = itemBalances.get(item.id) ?? item.balance;
              return (
                <ItemCard 
                  key={item.id} 
                  itemId={item.id} 
                  balance={balance}
                  onModalOpen={() => {
                    // Always expand the item when card is clicked (both Lab and non-Lab views)
                    setExpandedItemId(item.id);
                  }}
                  filterCategory={selectedFilter}
                  creatureId={creatureId}
                  selectedItemsForGoob={selectedItemsForGoob}
                  onAddItem={(itemId) => {
                    // Check if item is Epic
                    let isEpic = false;
                    try {
                      const queryKey = ['item-metadata', ITEM_V3_ADDRESS, itemId.toString()];
                      const cachedData = queryClient.getQueryData(queryKey);
                      if (cachedData) {
                        const metadata = cachedData as any;
                        if (metadata?.attributes) {
                          for (const attr of metadata.attributes) {
                            if (attr.trait_type === 'Rarity' && String(attr.value).toLowerCase().trim() === 'epic') {
                              isEpic = true;
                              break;
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
                                isEpic = true;
                                break;
                              }
                            }
                          }
                        }
                      } catch (e2) {
                        // Ignore
                      }
                    }
                    
                    // Check if there are already items selected
                    const currentTotal = Array.from(selectedItemsForGoob.values()).reduce((sum, count) => sum + count, 0);
                    
                    // Epic items can only be applied alone
                    if (isEpic && currentTotal > 0) {
                      return; // Don't add Epic if other items exist
                    }
                    
                    // Non-Epic items can't be added if Epic exists
                    if (!isEpic && currentTotal > 0) {
                      // Check if any existing item is Epic
                      let hasEpic = false;
                      for (const [existingId] of selectedItemsForGoob.entries()) {
                        try {
                          const queryKey = ['item-metadata', ITEM_V3_ADDRESS, existingId.toString()];
                          const cachedData = queryClient.getQueryData(queryKey);
                          if (cachedData) {
                            const metadata = cachedData as any;
                            if (metadata?.attributes) {
                              for (const attr of metadata.attributes) {
                                if (attr.trait_type === 'Rarity' && String(attr.value).toLowerCase().trim() === 'epic') {
                                  hasEpic = true;
                                  break;
                                }
                              }
                            }
                          }
                        } catch (e) {
                          try {
                            const key = `item-metadata-${ITEM_V3_ADDRESS}-${existingId}`;
                            const cached = localStorage.getItem(key);
                            if (cached) {
                              const metadata = JSON.parse(cached);
                              if (metadata?.attributes) {
                                for (const attr of metadata.attributes) {
                                  if (attr.trait_type === 'Rarity' && String(attr.value).toLowerCase().trim() === 'epic') {
                                    hasEpic = true;
                                    break;
                                  }
                                }
                              }
                            }
                          } catch (e2) {
                            // Ignore
                          }
                        }
                        if (hasEpic) break;
                      }
                      if (hasEpic) {
                        return; // Don't add non-Epic if Epic exists
                      }
                    }
                    
                    // Check if we've already reached the 3-item limit (for non-Epic)
                    if (!isEpic && currentTotal >= 3) {
                      return; // Don't add if already at limit
                    }
                    
                    // Add item to selected items
                    setSelectedItemsForGoob(prev => {
                      const next = new Map(prev);
                      const currentCount = next.get(itemId) || 0;
                      next.set(itemId, currentCount + 1);
                      return next;
                    });
                    
                    // Decrement balance
                    setItemBalances(prev => {
                      const next = new Map(prev);
                      const currentBalance = next.get(itemId) ?? item.balance;
                      if (currentBalance > 0n) {
                        next.set(itemId, currentBalance - 1n);
                      }
                      return next;
                    });
                    
                    // In simulation mode, also update simulationItems in parent
                    if (isSimulating && externalSetSimulationItems) {
                      externalSetSimulationItems(prev => {
                        const next = new Map(prev);
                        const currentBalance = next.get(itemId) ?? 0n;
                        if (currentBalance > 0n) {
                          next.set(itemId, currentBalance - 1n);
                        }
                        return next;
                      });
                    }
                  }}
                />
              );
            })}
        </div>
      )}
    </div>
  );
});

// Separate component for item card with metadata
const ItemCard: React.FC<{
  itemId: number;
  balance: bigint;
  onModalOpen: () => void;
  filterCategory: FilterCategory;
  creatureId?: bigint | number | null;
  selectedItemsForGoob?: Map<number, number>;
  onAddItem?: (itemId: number) => void;
}> = ({ itemId, balance, onModalOpen, filterCategory, creatureId, selectedItemsForGoob, onAddItem }) => {
  // Check if we have cached metadata - if so, load immediately
  const getCachedMetadata = (): any => {
    try {
      const cached = localStorage.getItem(`item-metadata-${ITEM_V3_ADDRESS}-${itemId}`);
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  };
  
  const hasCached = getCachedMetadata() !== null;
  
  // Only load metadata when the item is visible (lazy loading), unless we have cached data
  const [isVisible, setIsVisible] = useState(hasCached);
  const cardRef = useRef<HTMLDivElement>(null);
  const { metadata, isLoading } = useItemMetadata(isVisible ? itemId : null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!cardRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' } // Start loading 50px before item is visible
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // For thumbnails, prefer HTTP image URLs (faster, more reliable), fallback to image_data
  const thumbnailUrl = metadata?.image || metadata?.image_data || null;

  // Check if item matches the selected filter (checks Primary Trait or Rarity for Epic)
  const matchesFilter = React.useMemo(() => {
    if (filterCategory === 'All') return true;
    if (!metadata?.attributes) return true; // Show while loading
    
    for (const attr of metadata.attributes) {
      if (filterCategory === 'Epic') {
        if (attr.trait_type === 'Rarity') {
          const value = String(attr.value).toLowerCase();
          if (value === 'epic') return true;
        }
      } else if (attr.trait_type === 'Primary Trait') {
        const value = String(attr.value).toLowerCase();
        if (filterCategory === 'Freq' && value.includes('frequency')) return true;
        if (filterCategory === 'Temp' && value.includes('temperature')) return true;
        if (filterCategory === 'pH' && (value.includes('ph') || value === 'ph')) return true;
        if (filterCategory === 'Salinity' && value.includes('salinity')) return true;
      }
    }
    return false;
  }, [metadata, filterCategory]);

  // Don't render if it doesn't match the filter
  if (!matchesFilter) return null;

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddItem && balance > 0n) {
      // Check if we've already reached the 3-item limit
      const currentTotal = selectedItemsForGoob ? Array.from(selectedItemsForGoob.values()).reduce((sum, count) => sum + count, 0) : 0;
      if (currentTotal >= 3) {
        return; // Don't add if already at limit
      }
      onAddItem(itemId);
    }
  };

  const showPlusButton = Boolean(creatureId); // Only show in Lab view when Goob is selected
  const currentTotal = selectedItemsForGoob ? Array.from(selectedItemsForGoob.values()).reduce((sum, count) => sum + count, 0) : 0;
  const isAtLimit = currentTotal >= 3;
  
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
      ref={cardRef}
      className={styles.itemCard}
      style={{ 
        background: 'transparent',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'rgba(16, 185, 129, 0.2)',
        width: '100%',
        maxWidth: '100%',
        minHeight: '132px',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '4px',
        border: isEpic ? '2px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.2)',
        overflow: 'visible',
        transition: 'all 0.2s',
        margin: '0',
        padding: '0',
        boxSizing: 'border-box',
        position: 'relative',
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Always expand when card is clicked (plus button handles adding)
        onModalOpen();
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      }}
      onTouchEnd={(e) => {
        setTimeout(() => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }, 150);
      }}
    >
      {/* Image Section */}
      <div 
        style={{ 
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
        }}
      >
        {isLoading ? (
          <div style={{ fontSize: '8px', color: 'var(--muted)' }}>Loading...</div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={metadata?.name || `Item #${itemId}`}
            style={{ 
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              padding: '0',
              margin: '0',
              display: 'block',
            }}
            loading={hasCached ? "eager" : "lazy"}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div style={{ fontSize: '8px', color: 'var(--muted)' }}>No image</div>
        )}

        {/* Plus button in top right - only show in Lab view when Goob is selected and balance > 0 */}
        {showPlusButton && balance > 0n && (
          <button
            onClick={handleAddClick}
            className={styles.addButton}
            style={{
              color: isAtLimit ? 'rgba(128, 128, 128, 0.5)' : 'var(--muted)',
              cursor: isAtLimit ? 'not-allowed' : 'pointer',
              opacity: isAtLimit ? 0.5 : 1,
            }}
            disabled={isAtLimit}
          >
            +
          </button>
        )}

        {/* Quantity readout in bottom right of image */}
        <div 
          style={{ 
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            fontSize: '10px',
            color: 'rgb(110, 231, 183)',
            fontWeight: 300,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '2px 4px',
            borderRadius: '2px',
          }}
        >
          x{balance.toString()}
        </div>
      </div>

      {/* Info Section */}
      <div 
        style={{ 
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
        }}
      >
        <div 
          style={{ 
            fontSize: '12px',
            fontWeight: 300,
            lineHeight: '1.2',
            textAlign: 'center',
            color: 'var(--muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
        >
          {metadata?.name || `Item #${itemId}`}
        </div>
        {/* Trait and magnitude display */}
        {metadata?.attributes && (() => {
          let primaryTrait: string | null = null;
          let primaryDelta: number | null = null;
          
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
              primaryDelta = typeof attr.value === 'number' ? attr.value : parseInt(String(attr.value), 10);
            }
          }
          
          if (primaryTrait && primaryDelta !== null) {
            return (
              <div 
                style={{ 
                  fontSize: '15px',
                  fontWeight: 300,
                  lineHeight: '1.2',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  marginTop: '2px',
                  width: '100%',
                }}
              >
                {primaryTrait} {primaryDelta}
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
};

// Expanded Item view component
const ExpandedItemView: React.FC<{
  itemId: number;
  balance: bigint;
  onClose: () => void;
  creatureId?: bigint | number | null;
}> = ({ itemId, balance, onClose, creatureId }) => {
  const { metadata, isLoading } = useItemMetadata(itemId);
  const { state: creatureState } = useCreatureState(creatureId ? Number(creatureId) : 0);
  const imageUrl = metadata?.image || metadata?.image_data || null;
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 }); // Default to center (percentage)

  // Fix known description issues
  const fixedDescription = useMemo(() => {
    if (!metadata?.description) return metadata?.description;
    let desc = metadata.description;
    
    if (metadata.name === 'The Whisper-Jar Fragment') {
      desc = desc.replace('as if something is inside on the other side', 'as if something is on the other side');
    }
    
    return desc;
  }, [metadata?.description, metadata?.name]);

  // Parse attributes
  const itemAttributes = useMemo(() => {
    if (!metadata?.attributes) return null;

    let rarity: string | null = null;
    let primaryTrait: string | null = null;
    let primaryDelta: number | null = null;
    let secondaryTrait: string | null = null;
    let secondaryDelta: number | null = null;
    let spYield: number | null = null;

    for (const attr of metadata.attributes) {
      const type = attr.trait_type;
      const value = attr.value;

      if (type === 'Rarity') {
        rarity = String(value);
      } else if (type === 'Primary Trait') {
        primaryTrait = String(value);
      } else if (type === 'Primary Delta Magnitude') {
        primaryDelta = typeof value === 'number' ? value : parseInt(String(value), 10);
      } else if (type === 'Secondary Trait') {
        secondaryTrait = String(value);
      } else if (type === 'Secondary Delta Magnitude') {
        secondaryDelta = typeof value === 'number' ? value : parseInt(String(value), 10);
      } else if (type === 'SP Yield') {
        spYield = typeof value === 'number' ? value : parseInt(String(value), 10);
      }
    }

    return {
      rarity,
      primaryTrait,
      primaryDelta,
      secondaryTrait,
      secondaryDelta,
      spYield,
    };
  }, [metadata?.attributes]);

  // Determine effect colors
  const getEffectColor = (traitName: string | null, delta: number | null, isPrimary: boolean): string => {
    if (!traitName || delta === null) return 'var(--text)';
    
    if (isPrimary) return 'rgb(16, 185, 129)';

    if (!creatureState) return 'var(--text)';

    const traitMap: Record<string, { current: number; target: number }> = {
      'Salinity': { current: creatureState.currSal, target: creatureState.targetSal },
      'pH': { current: creatureState.currPH, target: creatureState.targetPH },
      'Temperature': { current: creatureState.currTemp, target: creatureState.targetTemp },
      'Frequency': { current: creatureState.currFreq, target: creatureState.targetFreq },
    };

    const trait = traitMap[traitName];
    if (!trait) return 'var(--text)';

    const distanceBefore = Math.abs(trait.current - trait.target);
    const newValue = trait.current + delta;
    const distanceAfter = Math.abs(newValue - trait.target);

    return distanceAfter < distanceBefore 
      ? 'rgb(16, 185, 129)'
      : 'rgb(220, 38, 38)';
  };

  // Check if item is Epic
  const isEpic = itemAttributes?.rarity?.toLowerCase().trim() === 'epic';
  
  return (
    <div 
      className={styles.expandedItemContainer}
      style={{
        border: isEpic ? '2px solid #fbbf24' : undefined,
      }}
    >
      <button
        className={styles.expandedCloseButton}
        onClick={onClose}
        aria-label="Close expanded view"
      >
        ×
      </button>
      <div className={styles.expandedItemContent}>
        {isLoading ? (
          <div className={styles.expandedLoading}>Loading item details...</div>
        ) : (
          <>
            <div className={styles.expandedItemImageWrapper}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={metadata?.name || `Item #${itemId}`}
                  className={`${styles.expandedItemImage} ${isZoomed ? styles.expandedItemImageZoomed : ''}`}
                  onClick={(e) => {
                    if (!isZoomed) {
                      // Only calculate click position when zooming IN
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setZoomOrigin({ x, y });
                    }
                    // Zoom out uses the same origin that was set during zoom in
                    setIsZoomed(!isZoomed);
                  }}
                  style={{
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`
                  }}
                />
              )}
              {/* Quantity readout in bottom right of image */}
              {imageUrl && (
                <div 
                  style={{ 
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    fontSize: '20px',
                    color: 'rgb(110, 231, 183)',
                    fontWeight: 300,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                >
                  x{balance.toString()}
                </div>
              )}
            </div>
            
            <div className={styles.expandedItemTitle}>
              {metadata?.name || `Item #${itemId}`}
            </div>
            
            {fixedDescription && (
              <div className={styles.expandedItemDescription}>
                {fixedDescription}
              </div>
            )}

            {itemAttributes && (
              <div className={styles.expandedItemAttributes}>
                {itemAttributes.rarity && (
                  <div className={styles.expandedAttributeItem}>
                    <span className={styles.expandedAttributeName}>Rarity</span>
                    <span className={styles.expandedAttributeValue}>{itemAttributes.rarity}</span>
                  </div>
                )}

                {itemAttributes.primaryTrait && itemAttributes.primaryDelta !== null && (
                  <div className={styles.expandedAttributeItem}>
                    <span className={styles.expandedAttributeName}>Primary Affect</span>
                    <span 
                      className={styles.expandedAttributeValue}
                      style={{ color: getEffectColor(itemAttributes.primaryTrait, itemAttributes.primaryDelta, true) }}
                    >
                      {itemAttributes.primaryTrait} {Math.abs(itemAttributes.primaryDelta)}
                    </span>
                  </div>
                )}

                {itemAttributes.secondaryTrait && itemAttributes.secondaryDelta !== null && (
                  <div className={styles.expandedAttributeItem}>
                    <span className={styles.expandedAttributeName}>Secondary Affect</span>
                    <span 
                      className={styles.expandedAttributeValue}
                      style={{ color: getEffectColor(itemAttributes.secondaryTrait, itemAttributes.secondaryDelta, false) }}
                    >
                      {itemAttributes.secondaryTrait} {Math.abs(itemAttributes.secondaryDelta)}
                    </span>
                  </div>
                )}

                {itemAttributes.spYield !== null && (
                  <div className={styles.expandedAttributeItem}>
                    <span className={styles.expandedAttributeName}>SP Yield</span>
                    <span className={styles.expandedAttributeValue}>{itemAttributes.spYield}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
