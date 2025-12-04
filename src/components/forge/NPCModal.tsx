import styles from './NPCModal.module.css';
import type { NPCToken, ScanProgress } from '../../hooks/forging/useNPCTokens';

type NPCModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: NPCToken) => void;
  tokens: NPCToken[];
  isLoading: boolean;
  progress: ScanProgress;
};

export default function NPCModal({
  isOpen,
  onClose,
  onSelect,
  tokens,
  isLoading,
  progress,
}: NPCModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        
        <h2 className={styles.title}>Choose Your NPC</h2>
        
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.loadingMessage}>{progress.message || 'Scanning...'}</div>
            <div className={styles.progressTrack}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progress.progress}%` }}
              ></div>
            </div>
          </div>
        ) : tokens.length === 0 ? (
          <div className={styles.empty}>
            <p>No NPCs found in your wallet.</p>
            <p className={styles.hint}>You need an NPC to forge coins.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {tokens.map(token => (
              <button
                key={token.tokenId.toString()}
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
                <span className={styles.npcXp}>XP: 0</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
