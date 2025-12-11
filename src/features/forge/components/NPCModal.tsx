import { useState } from 'react';
import styles from './NPCModal.module.css';
import type { NPCToken, ScanProgress } from '../hooks/useNPCTokens';
import { useNPCXP } from '../hooks/useNPCXP';

type NPCModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: NPCToken) => void;
  tokens: NPCToken[];
  isLoading: boolean;
  progress: ScanProgress;
  isConnected?: boolean;
  onConnect?: () => void;
};

function NPCCard({ 
  token, 
  onExpand,
  onChoose
}: { 
  token: NPCToken; 
  onExpand: (token: NPCToken) => void;
  onChoose: (token: NPCToken) => void;
}) {
  const { stats, isLoading: statsLoading } = useNPCXP(token.tokenId);
  
  return (
    <div className={styles.npcCardContainer}>
      <button
        className={styles.npcCard}
        onClick={() => onExpand(token)}
      >
        {token.imageUrl ? (
          <img 
            src={token.imageUrl} 
            alt={token.name} 
            className={styles.npcImage}
          />
        ) : (
          <div className={styles.npcPlaceholder}>
            #{token.tokenId.toString()}
          </div>
        )}
        <span className={styles.npcName}>{token.name}</span>
        <span className={styles.npcXp}>
          Crafts: {statsLoading ? '...' : (stats?.crafts ?? 0).toLocaleString()}
        </span>
      </button>
      <button
        className={styles.chooseButtonSmall}
        onClick={(e) => {
          e.stopPropagation();
          onChoose(token);
        }}
      >
        Choose
      </button>
    </div>
  );
}

function NPCExpandedView({ 
  token, 
  onClose, 
  onChoose 
}: { 
  token: NPCToken; 
  onClose: () => void;
  onChoose: () => void;
}) {
  const { stats, isLoading } = useNPCXP(token.tokenId);

  return (
    <div className={styles.expandedView}>
      <button className={styles.closeButton} onClick={onClose}>×</button>
      <h3 className={styles.expandedTitle}>NPC #{token.tokenId.toString()}</h3>
      
      <div className={styles.expandedContent}>
        {token.imageUrl ? (
          <img 
            src={token.imageUrl} 
            alt={token.name} 
            className={styles.expandedImage}
          />
        ) : (
          <div className={styles.expandedPlaceholder}>
          </div>
        )}
        
        {isLoading ? (
          <div className={styles.loadingStats}>Loading stats...</div>
        ) : stats ? (
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Crafts:</span>
              <span className={styles.statValue}>{stats.crafts.toLocaleString()}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total NGT Crafted:</span>
              <span className={styles.statValue}>{stats.totalNGTCrafted.toString()}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Coal Burned:</span>
              <span className={styles.statValue}>{stats.totalCoalBurned.toString()}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>NGT Fees Earned:</span>
              <span className={styles.statValue}>{stats.totalNGTFee.toString()}</span>
            </div>
            {stats.name && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Custom Name:</span>
                <span className={styles.statValue}>{stats.name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.noStats}>No stats available</div>
        )}
        
        <button 
          className={styles.chooseButton}
          onClick={onChoose}
        >
          Choose
        </button>
      </div>
    </div>
  );
}

export default function NPCModal({
  isOpen,
  onClose,
  onSelect,
  tokens,
  isLoading,
  progress,
  isConnected = true,
  onConnect,
}: NPCModalProps) {
  const [expandedToken, setExpandedToken] = useState<NPCToken | null>(null);

  if (!isOpen) return null;

  const handleExpand = (token: NPCToken) => {
    setExpandedToken(token);
  };

  const handleChoose = () => {
    if (expandedToken) {
      onSelect(expandedToken);
      setExpandedToken(null);
    }
  };

  const handleCloseExpanded = () => {
    setExpandedToken(null);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {expandedToken ? (
          <NPCExpandedView
            token={expandedToken}
            onClose={handleCloseExpanded}
            onChoose={handleChoose}
          />
        ) : (
          <>
            <button className={styles.closeButton} onClick={onClose}>×</button>
            
            <h2 className={styles.title}>My NPCs</h2>
            <p className={styles.helpText}>Click on NPC to expand details</p>
            
            {!isConnected ? (
              <div className={styles.empty}>
                {onConnect && (
                  <button 
                    className={styles.connectButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnect();
                    }}
                  >
                    Connect Wallet
                  </button>
                )}
                <p className={styles.connectHint}>to view NPCs</p>
              </div>
            ) : isLoading || progress.stage === 'scanning' || progress.stage === 'metadata' ? (
              <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <div className={styles.loadingMessage}>Scanning wallet for NPCs</div>
                <div className={styles.progressTrack}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${progress.progress}%` }}
                  ></div>
                </div>
              </div>
            ) : !isLoading && (progress.stage === 'complete' || progress.stage === 'error') && tokens.length === 0 ? (
              <div className={styles.empty}>
                <p>No NPCs found in your wallet.</p>
                <p className={styles.hint}>You need an NPC to forge coins.</p>
              </div>
            ) : tokens.length > 0 ? (
              <div className={styles.grid}>
                {tokens.map(token => (
                  <NPCCard
                    key={token.tokenId.toString()}
                    token={token}
                    onExpand={handleExpand}
                    onChoose={(token) => {
                      onSelect(token);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <div className={styles.loadingMessage}>Scanning wallet for NPCs</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
