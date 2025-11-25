// src/components/stabilization/ItemSelector.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useWalletItemsSummary } from '../../hooks/stabilizationV3/useWalletItemsSummary';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
import { useCreatureState } from '../../hooks/stabilizationV3/useCreatureState';
import { ITEM_V3_ADDRESS } from '../../config/contracts/stabilizationV3';
import styles from './ItemSelector.module.css';

type FilterCategory = 'All' | 'Freq' | 'Temp' | 'pH' | 'Salinity';

type ItemSelectorProps = {
  creatureId?: bigint | number | null;
  isSimulating?: boolean;
};

export const ItemSelector: React.FC<ItemSelectorProps> = ({ creatureId, isSimulating = false }) => {
  const { address } = useAccount();
  const { items: walletItems, isLoading: walletIsLoading, isError } = useWalletItemsSummary();
  
  // In simulation mode, show empty inventory
  const items = isSimulating ? [] : walletItems;
  const isLoading = isSimulating ? false : walletIsLoading;
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('Freq');
  
  // Track selected items for the Goob (items added via "+")
  // Map of itemId -> count
  const [selectedItemsForGoob, setSelectedItemsForGoob] = useState<Map<number, number>>(new Map());
  
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
          {(['Freq', 'Temp', 'pH', 'Salinity', 'All'] as FilterCategory[]).map((category) => (
            <button
              key={category}
              className={`${styles.filterButton} ${selectedFilter === category ? styles.filterButtonActive : ''}`}
              onClick={() => setSelectedFilter(category)}
            >
              {category}
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
            .map((item) => {
              const balance = itemBalances.get(item.id) ?? item.balance;
              return (
                <ItemCard 
                  key={item.id} 
                  itemId={item.id} 
                  balance={balance}
                  onModalOpen={() => setExpandedItemId(item.id)}
                  filterCategory={selectedFilter}
                  creatureId={creatureId}
                  onAddItem={(itemId) => {
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
                  }}
                />
              );
            })}
        </div>
      )}
    </div>
  );
};

// Separate component for item card with metadata
const ItemCard: React.FC<{
  itemId: number;
  balance: bigint;
  onModalOpen: () => void;
  filterCategory: FilterCategory;
  creatureId?: bigint | number | null;
  onAddItem?: (itemId: number) => void;
}> = ({ itemId, balance, onModalOpen, filterCategory, creatureId, onAddItem }) => {
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

  // Check if item matches the selected filter (only checks Primary Trait)
  const matchesFilter = React.useMemo(() => {
    if (filterCategory === 'All') return true;
    if (!metadata?.attributes) return true; // Show while loading
    
    for (const attr of metadata.attributes) {
      if (attr.trait_type === 'Primary Trait') {
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
      onAddItem(itemId);
    }
  };

  const showPlusButton = Boolean(creatureId); // Only show in Lab view when Goob is selected

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
        border: '1px solid rgba(255, 255, 255, 0.2)',
        overflow: 'visible',
        transition: 'all 0.2s',
        margin: '0',
        padding: '0',
        boxSizing: 'border-box',
        position: 'relative',
      }}
      onClick={(e) => {
        e.stopPropagation();
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
              color: 'var(--muted)',
            }}
          >
            +
          </button>
        )}
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
            marginBottom: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
        >
          {metadata?.name || `Item #${itemId}`}
        </div>
        <div 
          style={{ 
            fontSize: '10px',
            color: 'rgb(110, 231, 183)',
            fontWeight: 300,
          }}
        >
          x{balance.toString()}
        </div>
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

  return (
    <div className={styles.expandedItemContainer}>
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
                <div className={styles.expandedAttributeItem}>
                  <span className={styles.expandedAttributeName}>Qty</span>
                  <span className={styles.expandedAttributeValue}>x{balance.toString()}</span>
                </div>
                
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
