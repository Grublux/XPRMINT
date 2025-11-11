import { useGame } from '../../state/gameStore';
import styles from './DialReadout.module.css';

export default function DialReadout(){
  const { selectedIdx, numbers } = useGame();
  
  if (selectedIdx === null || selectedIdx >= numbers.length) {
    return null;
  }

  const selectedNumber = numbers[selectedIdx];
  const addHz = selectedNumber;
  const subHz = selectedNumber;

  return (
    <div className={styles.container}>
      <div className={styles.readout}>
        <div className={styles.label}>FREQUENCY TUNING</div>
        <div className={styles.value}>{selectedNumber} Hz</div>
      </div>
      
      <div className={styles.dialContainer}>
        <div className={styles.dial}>
          <div className={styles.dialFace}>
            <div className={styles.dialCenter}></div>
            <div className={styles.dialNeedle}></div>
          </div>
        </div>
        <div className={styles.dialLabels}>
          <div className={styles.upLabel}>+{addHz} Hz</div>
          <div className={styles.downLabel}>-{subHz} Hz</div>
        </div>
      </div>
    </div>
  );
}


