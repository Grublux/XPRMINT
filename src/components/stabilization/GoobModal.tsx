// src/components/stabilization/GoobModal.tsx
// Modal component for displaying expanded Goob details

import React from 'react';
import { useAccount } from 'wagmi';
import { useGoobMetadata } from '../../hooks/goobs/useGoobMetadata';
import { useCreatureState } from '../../hooks/stabilizationV3/useCreatureState';
import styles from './GoobModal.module.css';

type GoobModalProps = {
  tokenId: bigint;
  isOpen: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
};

export const GoobModal: React.FC<GoobModalProps> = ({ tokenId, isOpen, onClose, isReadOnly }) => {
  const { address } = useAccount();
  const { metadata, isLoading } = useGoobMetadata(tokenId);
  const { state: creatureState, isError: stateError } = useCreatureState(Number(tokenId));

  if (!isOpen) return null;

  // Check if creature is initialized (has non-zero target values)
  // Note: creatureState can be null if the creature doesn't exist or query failed
  // We still want to show traits/vibes with empty values in that case
  const isInitialized = creatureState !== null && 
    !(creatureState.targetSal === 0 && creatureState.targetPH === 0 && 
      creatureState.targetTemp === 0 && creatureState.targetFreq === 0);
  
  // Show button when wallet is connected and creature is NOT initialized
  const shouldShowButton = Boolean(address) && (creatureState === null || !isInitialized || stateError);

  const handleClaimStarterPack = () => {
    // Placeholder - button does nothing for now
    // TODO: Implement navigation to experiment page
    // navigate(`/experiment?goob=${tokenId.toString()}`);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        
        {isLoading ? (
          <div className={styles.loading}>Loading Goob details...</div>
        ) : (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Goob #{tokenId.toString()}</h2>
              {metadata?.image && (
                <div className={styles.imageContainer}>
                  <img 
                    src={metadata.image} 
                    alt={`Goob #${tokenId.toString()}`}
                    className={styles.goobImage}
                  />
                  {/* Essence traits preview (if available) */}
                  {metadata?.essence && Object.keys(metadata.essence).length > 0 && (
                    <div className={styles.essenceTraits}>
                      {Object.entries(metadata.essence).slice(0, 2).map(([key, value]) => (
                        <div
                          key={key}
                          className={styles.essenceTraitBadge}
                        >
                          {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stabilization Traits (always show, even if not initialized) */}
            <div className={styles.traitsSection}>
              {shouldShowButton && (
                <div className={styles.notInitialized}>
                  <button 
                    onClick={isReadOnly ? undefined : handleClaimStarterPack}
                    disabled={isReadOnly}
                    className={styles.claimButton}
                  >
                    {isReadOnly ? "No Access" : "Claim Your Starter Pack"}
                  </button>
                </div>
              )}
              <h3 className={styles.sectionTitle}>Stabilization Traits</h3>
              <div className={styles.traitsList}>
                <div className={styles.traitItem}>
                  <span className={styles.traitName}>Salinity</span>
                  {isInitialized && creatureState ? (
                    <span className={styles.traitValue}>
                      {creatureState.currSal} / {creatureState.targetSal}
                      {creatureState.lockedSal && <span className={styles.lockedBadge}> LOCKED</span>}
                    </span>
                  ) : (
                    <span className={styles.traitValueEmpty}>—</span>
                  )}
                </div>
                <div className={styles.traitItem}>
                  <span className={styles.traitName}>pH</span>
                  {isInitialized && creatureState ? (
                    <span className={styles.traitValue}>
                      {creatureState.currPH} / {creatureState.targetPH}
                      {creatureState.lockedPH && <span className={styles.lockedBadge}> LOCKED</span>}
                    </span>
                  ) : (
                    <span className={styles.traitValueEmpty}>—</span>
                  )}
                </div>
                <div className={styles.traitItem}>
                  <span className={styles.traitName}>Temperature</span>
                  {isInitialized && creatureState ? (
                    <span className={styles.traitValue}>
                      {creatureState.currTemp} / {creatureState.targetTemp}
                      {creatureState.lockedTemp && <span className={styles.lockedBadge}> LOCKED</span>}
                    </span>
                  ) : (
                    <span className={styles.traitValueEmpty}>—</span>
                  )}
                </div>
                <div className={styles.traitItem}>
                  <span className={styles.traitName}>Frequency</span>
                  {isInitialized && creatureState ? (
                    <span className={styles.traitValue}>
                      {creatureState.currFreq} / {creatureState.targetFreq}
                      {creatureState.lockedFreq && <span className={styles.lockedBadge}> LOCKED</span>}
                    </span>
                  ) : (
                    <span className={styles.traitValueEmpty}>—</span>
                  )}
                </div>
                <div className={styles.traitItem}>
                  <span className={styles.traitName}>Vibes</span>
                  {isInitialized && creatureState ? (
                    <span className={styles.traitValue}>{creatureState.vibes}</span>
                  ) : (
                    <span className={styles.traitValueEmpty}>—</span>
                  )}
                </div>
              </div>
            </div>


          </>
        )}
      </div>
    </div>
  );
};

