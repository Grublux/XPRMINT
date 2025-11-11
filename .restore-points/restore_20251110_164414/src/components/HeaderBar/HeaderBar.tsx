import { useTimer } from '../../hooks/useTimer';
import { useGame } from '../../state/gameStore';
import styles from './HeaderBar.module.css';

export default function HeaderBar(){
  const { pot, targetHz, lastMoveAt, status, ngtBalance } = useGame();
  const { label, remaining } = useTimer(lastMoveAt);
  const danger = remaining <= 60_000 && status==='active';
  return (
    <div className={styles.header}>
      <div className={styles.metric}>💰 POT: {pot.toLocaleString()} NGT</div>
      <div className={styles.row}>
        <div className={styles.badge}>TARGET FREQUENCY: {targetHz} Hz</div>
        <div className={styles.badge}>NGT: {ngtBalance.toLocaleString()}</div>
      </div>
      <div className={`${styles.metric} ${danger ? styles.timerRed : ''}`}>⏳ {label}</div>
    </div>
  );
}
