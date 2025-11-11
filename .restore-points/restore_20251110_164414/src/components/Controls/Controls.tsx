import { useGame } from '../../state/gameStore';
import NumberChips from '../NumberChips/NumberChips';
import PurchaseNumber from '../PurchaseNumber/PurchaseNumber';
import styles from './Controls.module.css';

export default function Controls(){
  const { numbers } = useGame();
  return (
    <div className={styles.panel}>
      <div className={styles.label}>
        Your Numbers <span className={styles.count}>{numbers.length}/3</span>
      </div>
      <NumberChips/>
      <PurchaseNumber/>
    </div>
  );
}
