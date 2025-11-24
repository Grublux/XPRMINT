// src/components/stabilization/ItemModal.tsx
// Modal component for displaying expanded Item details

import React from 'react';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
import styles from './ItemModal.module.css';

type ItemModalProps = {
  itemId: number;
  isOpen: boolean;
  onClose: () => void;
};

export const ItemModal: React.FC<ItemModalProps> = ({ itemId, isOpen, onClose }) => {
  const { metadata, isLoading } = useItemMetadata(itemId);

  if (!isOpen) return null;

  // Prefer full-size image (1024x1024) for modal
  const imageUrl = metadata?.image || metadata?.image_data || null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        
        {isLoading ? (
          <div className={styles.loading}>Loading item details...</div>
        ) : (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>{metadata?.name || `Item #${itemId}`}</h2>
              {imageUrl && (
                <img 
                  src={imageUrl} 
                  alt={metadata?.name || `Item #${itemId}`}
                  className={styles.itemImage}
                />
              )}
            </div>

            {metadata?.description && (
              <div className={styles.description}>
                {metadata.description}
              </div>
            )}

            {metadata?.attributes && metadata.attributes.length > 0 && (
              <div className={styles.attributesSection}>
                <h3 className={styles.sectionTitle}>Attributes</h3>
                <div className={styles.attributesList}>
                  {metadata.attributes.map((attr, idx) => (
                    <div key={idx} className={styles.attributeItem}>
                      <span className={styles.attributeName}>{attr.trait_type}</span>
                      <span className={styles.attributeValue}>{String(attr.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

