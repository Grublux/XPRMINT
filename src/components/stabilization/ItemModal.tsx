// src/components/stabilization/ItemModal.tsx
// Modal component for displaying expanded Item details

import React, { useMemo } from 'react';
import { useItemMetadata } from '../../hooks/stabilizationV3/useItemMetadata';
import { useCreatureState } from '../../hooks/stabilizationV3/useCreatureState';
import styles from './ItemModal.module.css';

type ItemModalProps = {
  itemId: number;
  isOpen: boolean;
  onClose: () => void;
  creatureId?: bigint | number | null;
};

export const ItemModal: React.FC<ItemModalProps> = ({ itemId, isOpen, onClose, creatureId }) => {
  const { metadata, isLoading } = useItemMetadata(itemId);
  const { state: creatureState } = useCreatureState(creatureId ? Number(creatureId) : 0);

  if (!isOpen) return null;

  // Prefer full-size image (1024x1024) for modal
  const imageUrl = metadata?.image || metadata?.image_data || null;

  // Fix known description issues (frontend workaround until metadata is updated on-chain)
  const fixedDescription = useMemo(() => {
    if (!metadata?.description) return metadata?.description;
    let desc = metadata.description;
    
    // Fix Whisper-Jar Fragment description
    if (metadata.name === 'The Whisper-Jar Fragment') {
      desc = desc.replace('as if something is inside on the other side', 'as if something is on the other side');
    }
    
    return desc;
  }, [metadata?.description, metadata?.name]);

  // Parse attributes into structured format
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

  // Determine if effects move towards or away from target
  const getEffectColor = (traitName: string | null, delta: number | null, isPrimary: boolean): string => {
    if (!traitName || delta === null) return 'var(--text)';
    
    // Primary always moves towards target (green) - even without creature state
    if (isPrimary) return 'rgb(16, 185, 129)'; // green

    // For secondary, only color when we have creature state
    if (!creatureState) return 'var(--text)';

    // For secondary, determine direction based on current vs target
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

    // If distance decreases, moving towards target (green)
    // If distance increases, moving away from target (red)
    return distanceAfter < distanceBefore 
      ? 'rgb(16, 185, 129)' // green - towards target
      : 'rgb(220, 38, 38)'; // red - away from target
  };

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

            {fixedDescription && (
              <div className={styles.description}>
                {fixedDescription}
              </div>
            )}

            {itemAttributes && (
              <div className={styles.attributesSection}>
                <h3 className={styles.sectionTitle}>Attributes</h3>
                <div className={styles.attributesList}>
                  <div className={styles.attributeItem}>
                    <span className={styles.attributeName}>Item Name</span>
                    <span className={styles.attributeValue}>{metadata?.name || `Item #${itemId}`}</span>
                  </div>
                  
                  {itemAttributes.rarity && (
                    <div className={styles.attributeItem}>
                      <span className={styles.attributeName}>Rarity</span>
                      <span className={styles.attributeValue}>{itemAttributes.rarity}</span>
                    </div>
                  )}

                  {itemAttributes.primaryTrait && itemAttributes.primaryDelta !== null && (
                    <div className={styles.attributeItem}>
                      <span className={styles.attributeName}>Primary Affect</span>
                      <span 
                        className={styles.attributeValue}
                        style={{ color: getEffectColor(itemAttributes.primaryTrait, itemAttributes.primaryDelta, true) }}
                      >
                        {itemAttributes.primaryTrait} {Math.abs(itemAttributes.primaryDelta)}
                      </span>
                    </div>
                  )}

                  {itemAttributes.secondaryTrait && itemAttributes.secondaryDelta !== null && (
                    <div className={styles.attributeItem}>
                      <span className={styles.attributeName}>Secondary Affect</span>
                      <span 
                        className={styles.attributeValue}
                        style={{ color: getEffectColor(itemAttributes.secondaryTrait, itemAttributes.secondaryDelta, false) }}
                      >
                        {itemAttributes.secondaryTrait} {Math.abs(itemAttributes.secondaryDelta)}
                      </span>
                    </div>
                  )}

                  {itemAttributes.spYield !== null && (
                    <div className={styles.attributeItem}>
                      <span className={styles.attributeName}>SP Yield</span>
                      <span className={styles.attributeValue}>{itemAttributes.spYield}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

