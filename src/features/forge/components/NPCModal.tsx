import styles from './NPCModal.module.css';
import type { NPCToken, ScanProgress } from '@/features/forge/hooks/useNPCTokens';
import { useNPCXP } from '@/features/forge/hooks/useNPCXP';

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

function NPCCard({ token, onSelect }: { token: NPCToken; onSelect: (token: NPCToken) => void }) {
  const { xp, isLoading: xpLoading } = useNPCXP(token.tokenId);
  
  return (
    <button
      className={styles.npcCard}
      onClick={() => onSelect(token)}
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
        XP: {xpLoading ? '...' : xp.toLocaleString()}
      </span>
    </button>
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
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        
        <h2 className={styles.title}>Choose Your NPC</h2>
        
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
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <div className={styles.loadingMessage}>Scanning wallet for NPCs</div>
          </div>
        )}
      </div>
    </div>
  );
}
