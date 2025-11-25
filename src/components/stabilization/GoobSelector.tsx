// src/components/stabilization/GoobSelector.tsx

import React, { useState } from 'react';
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
}

type LabFilter = 'Waiting Room' | 'Lab';

export const GoobSelector: React.FC<GoobSelectorProps> = ({ 
  selectedId, 
  onChange,
  isSimulating = false,
  selectedItemsForGoob = new Map(),
}) => {
  const { goobs: walletGoobs, isLoading: walletIsLoading, isError, error, progress } = useUserGoobs();
  const { goobs: simulatedGoobs, isLoading: simulatedIsLoading } = useSimulatedGoobs();
  
  // Use simulated Goobs when simulation is on, otherwise use wallet Goobs
  const goobs = isSimulating ? simulatedGoobs : walletGoobs;
  const isLoading = isSimulating ? simulatedIsLoading : walletIsLoading;
  const [expandedGoobId, setExpandedGoobId] = useState<bigint | null>(null);
  const [labFilter, setLabFilter] = useState<LabFilter>('Waiting Room');
  const [goobsInLab, setGoobsInLab] = useState<Set<string>>(new Set());
  const [goobsSelectedForBatch, setGoobsSelectedForBatch] = useState<Set<string>>(new Set());

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

  const handleBatchSendToLab = () => {
    const selectedGoobIds = Array.from(goobsSelectedForBatch).map(id => BigInt(id));
    
    if (selectedGoobIds.length === 0) {
      console.log('[Batch Send] No Goobs selected');
      return;
    }

    console.log('[Batch Send] Would send to lab:', selectedGoobIds.map(id => id.toString()));
    
    // TODO: For testing only - placeholder for actual implementation
    // Sending to lab = Initialize creature + Claim starter pack (5 items per Goob)
    // This would:
    // 1. For each goobId in selectedGoobIds:
    //    - Initialize creature with creatureId = goobId (initializeCreature)
    //    - Claim initial starter pack (claimDailyItems) - this gives 5 items
    // 2. After successful batch, move them to "In Lab" and clear selection
    
    // For now, just log what would happen
    selectedGoobIds.forEach((goobId) => {
      console.log(`[Batch Send] Would initialize creature ${goobId.toString()} and claim starter pack (5 items)`);
    });

    // After successful batch (for now, immediately for testing):
    // Move selected Goobs to "In Lab" and clear selection
    setGoobsInLab(prev => {
      const next = new Set(prev);
      goobsSelectedForBatch.forEach(id => next.add(id));
      return next;
    });
    setGoobsSelectedForBatch(new Set());
  };

  return (
    <div style={{ paddingTop: '20px', width: '100%' }}>
      {/* Filter Buttons - hidden when Goob is expanded */}
      {!expandedGoobId && (
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
          className={`${styles.filterButton} ${labFilter === 'Lab' ? styles.filterButtonActive : ''}`}
          onClick={() => {
            setLabFilter('Lab');
            setExpandedGoobId(null);
            onChange(null); // Clear selection when switching tabs
          }}
        >
          Lab
        </button>
        </div>
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
    </div>
  );
};

// Expanded Goob view component
const ExpandedGoobView: React.FC<{
  tokenId: bigint;
  onClose: () => void;
  selectedItemsForGoob?: Map<number, number>;
}> = ({ tokenId, onClose, selectedItemsForGoob = new Map() }) => {
  const { metadata, isLoading } = useGoobMetadata(tokenId);
  const { state: creatureState } = useCreatureState(Number(tokenId));
  const imageUrl = metadata?.image_data || metadata?.image || null;

  const isInitialized = creatureState !== null && 
    !(creatureState.targetSal === 0 && creatureState.targetPH === 0 && 
      creatureState.targetTemp === 0 && creatureState.targetFreq === 0);

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
                  Place items in order to finalize effects
                </div>
                <div className={styles.selectedItemsGrid}>
                  {Array.from(selectedItemsForGoob.entries()).map(([itemId, count]) => (
                    <SelectedItemDisplay key={itemId} itemId={itemId} count={count} />
                  ))}
                </div>
              </div>
            ) : (
              <div>Choose items below to apply to Goob</div>
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
const SelectedItemDisplay: React.FC<{ itemId: number; count: number }> = ({ itemId, count }) => {
  const { metadata, isLoading } = useItemMetadata(itemId);
  const imageUrl = metadata?.image || metadata?.image_data || null;
  
  return (
    <div style={{
      background: 'transparent',
      cursor: 'default',
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

