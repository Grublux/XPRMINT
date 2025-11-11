import styles from './TimeoutOverlay.module.css';
import { useGame } from '../../state/gameStore';

export default function TimeoutOverlay(){
  const { status, resetRound } = useGame();
  if (status !== 'timeout') return null;
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true">
      <div className={styles.box} tabIndex={-1}>
        <h2 className={styles.title}>Experiment failed</h2>
        <p>No activity for 10 minutes. Pot splits to Closest-7 (stubbed in MVP).</p>
        <div className={styles.row}>
          <button className={styles.btn} onClick={resetRound}>Start New Round</button>
        </div>
      </div>
    </div>
  );
}
