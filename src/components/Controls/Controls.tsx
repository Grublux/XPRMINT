import { useGame } from '../../state/gameStore';
import NumberChips from '../NumberChips/NumberChips';
import styles from './Controls.module.css';

export default function Controls(){
  return (
    <div className={styles.panel}>
      <NumberChips/>
    </div>
  );
}
