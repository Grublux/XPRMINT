// src/components/stabilization/ItemSelector.tsx

import React from 'react';
import { useWalletItemsSummary } from '../../hooks/stabilizationV3/useWalletItemsSummary';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
import styles from './ItemSelector.module.css';

type ItemSelectorProps = {
  items?: Array<{ id: number; balance: bigint }>;
};

export const ItemSelector: React.FC<ItemSelectorProps> = ({ items: providedItems }) => {
  const { items: walletItems, isLoading: walletIsLoading, isError } = useWalletItemsSummary();
  
  // Use provided items if in simulate mode, otherwise use wallet items
  const items = providedItems ?? walletItems;
  const isLoading = providedItems ? false : walletIsLoading;

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
    return (
      <div className="flex flex-col gap-2 items-center text-center w-full">
        <div className="text-sm text-muted-foreground">
          No items detected. Claim your starter pack or daily drip from the lab.
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '20px', width: '100%' }}>
      <div className={styles.itemGrid}>
        {items.map((item) => (
          <ItemCard key={item.id} itemId={item.id} balance={item.balance} />
        ))}
      </div>
    </div>
  );
};

// Separate component for item card with metadata
const ItemCard: React.FC<{
  itemId: number;
  balance: bigint;
}> = ({ itemId, balance }) => {
  const { metadata, isLoading } = useItemMetadata(itemId);

  // Get image URL (prefer image for HTTP URLs, fallback to image_data for on-chain)
  const imageUrl = metadata?.image || metadata?.image_data || null;

  return (
    <div
      className={styles.itemCard}
      style={{ 
        background: 'transparent',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'rgba(16, 185, 129, 0.2)',
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        overflow: 'visible',
        transition: 'all 0.2s',
        margin: '0',
        padding: '0',
        boxSizing: 'border-box',
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
          height: 'auto',
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          flexShrink: 0,
          padding: '0',
          margin: '0',
        }}
      >
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
