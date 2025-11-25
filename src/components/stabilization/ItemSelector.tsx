// src/components/stabilization/ItemSelector.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useWalletItemsSummary } from '../../hooks/stabilizationV3/useWalletItemsSummary';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
import { ItemModal } from './ItemModal';
import { ITEM_V3_ADDRESS } from '../../config/contracts/stabilizationV3';
import styles from './ItemSelector.module.css';

type FilterCategory = 'All' | 'Freq' | 'Temp' | 'pH' | 'Salinity';

type ItemSelectorProps = {
  creatureId?: bigint | number | null;
};

export const ItemSelector: React.FC<ItemSelectorProps> = ({ creatureId }) => {
  const { address } = useAccount();
  const { items: walletItems, isLoading: walletIsLoading, isError } = useWalletItemsSummary();
  const [selectedItemForModal, setSelectedItemForModal] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('Freq');
  
  const items = walletItems;
  const isLoading = walletIsLoading;

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
            You have no items, claim a starter pack or head to{' '}
            <a 
              href="https://magiceden.us/u/0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf?chains=%5B%22apechain%22%5D&wallets=%5B%220x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf%22%5D&activeTab=%22allItems%22"
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
      {/* Filter Buttons */}
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
      
      <div className={styles.itemGrid}>
        {items.map((item) => (
          <ItemCard 
            key={item.id} 
            itemId={item.id} 
            balance={item.balance}
            onModalOpen={() => setSelectedItemForModal(item.id)}
            filterCategory={selectedFilter}
          />
        ))}
      </div>
      {selectedItemForModal !== null && (
        <ItemModal
          itemId={selectedItemForModal}
          isOpen={selectedItemForModal !== null}
          onClose={() => setSelectedItemForModal(null)}
          creatureId={creatureId}
        />
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
}> = ({ itemId, balance, onModalOpen, filterCategory }) => {
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
        overflow: 'hidden',
        transition: 'all 0.2s',
        margin: '0',
        padding: '0',
        boxSizing: 'border-box',
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
