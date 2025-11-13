import { useGame } from '../../state/gameStore';
import NumberChips from '../NumberChips/NumberChips';
import styles from './CenterDial.module.css';

export default function CenterDial(){
  const { selectedIdx, numbers, canBuyNumber, buyNumber } = useGame();
  const hasSelection = selectedIdx !== null && selectedIdx < numbers.length;
  
  let selectedNumber = 0;
  if (hasSelection) {
    selectedNumber = numbers[selectedIdx];
  }

  const can = canBuyNumber();

  return (
    <div className={styles.container}>
      <div className={styles.dialSection}>
        <div className={styles.frequencyReadout}>
          {hasSelection ? `${selectedNumber} Hz` : '-- Hz'}
        </div>
      </div>
      <div className={styles.numbersSection}>
        <NumberChips/>
      </div>
      <button
        className={styles.buyButton}
        onClick={buyNumber}
        disabled={!can}
        aria-label="Buy a new number"
      >
        Buy
      </button>
    </div>
  );
}
