import styles from './ForgeSuccessModal.module.css';

type ForgeSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  coinsForged: number;
};

// TODO: Update with actual Magic Eden collection URL when deployed
const MAGIC_EDEN_URL = 'https://magiceden.io/collections/apechain/your-collection-here';

export default function ForgeSuccessModal({
  isOpen,
  onClose,
  coinsForged,
}: ForgeSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.successIcon}>🪙</div>
        
        <h2 className={styles.title}>Forge Complete!</h2>
        
        <p className={styles.message}>
          Successfully forged {coinsForged} coin{coinsForged > 1 ? 's' : ''}
        </p>
        
        <a 
          href={MAGIC_EDEN_URL} 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.magicEdenLink}
        >
          View on Magic Eden →
        </a>
        
        <button className={styles.dismissBtn} onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

