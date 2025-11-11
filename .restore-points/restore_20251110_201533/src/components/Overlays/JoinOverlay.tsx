import { useEffect } from 'react';
import { useGame } from '../../state/gameStore';
import styles from './JoinOverlay.module.css';

export default function JoinOverlay(){
  const { status, hasJoined, ngtBalance, initialPackCost, joinWithInitialPack } = useGame();

  if (hasJoined) return null;
  // show overlay whenever not joined; status will be 'idle' after resetRound
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true">
      <div className={styles.box} tabIndex={-1}>
        <h2 className={styles.title}>Join the Experiment</h2>
        <p>Purchase your initial pack of <strong>3 numbers</strong> to begin.</p>
        <div className={styles.row}>
          <div className={styles.balance}>Balance: {ngtBalance.toLocaleString()} NGT</div>
          <div className={styles.cost}>Cost: {initialPackCost.toLocaleString()} NGT</div>
        </div>
        <div className={styles.row}>
          <button
            className={styles.btn}
            onClick={joinWithInitialPack}
            disabled={ngtBalance < initialPackCost}
            aria-disabled={ngtBalance < initialPackCost}
          >
            Buy Initial Pack (3)
          </button>
        </div>
        {ngtBalance < initialPackCost && (
          <p className={styles.warn}>Insufficient NGT to join.</p>
        )}
      </div>
    </div>
  );
}
