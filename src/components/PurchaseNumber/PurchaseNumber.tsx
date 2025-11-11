import { useGame } from '../../state/gameStore';
import styles from './PurchaseNumber.module.css';

export default function PurchaseNumber(){
  const { hasJoined, numbers, singleNumberCost, canBuyNumber, buyNumber } = useGame();
  const can = canBuyNumber();
  const atCap = numbers.length >= 3;

  return (
    <div className={styles.wrap} aria-live="polite">
      <button
        className={styles.btn}
        onClick={buyNumber}
        disabled={!can}
        aria-disabled={!can}
        title={atCap ? 'You already have 3 numbers' : 'Buy a new number'}
      >
        Buy Number{'\n'}{singleNumberCost.toLocaleString()}NGT
      </button>
      {!hasJoined && <div className={styles.helper}>Join first</div>}
    </div>
  );
}
