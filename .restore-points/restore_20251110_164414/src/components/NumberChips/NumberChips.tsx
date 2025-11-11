import { useGame } from '../../state/gameStore';
import styles from './NumberChips.module.css';

export default function NumberChips(){
  const { numbers, used, selectedIdx, selectIdx } = useGame();
  return (
    <div className={styles.row} role="group" aria-label="Choose a number">
      {numbers.map((n,i)=>(
        <button key={i}
          className={`${styles.chip} ${used[i] ? styles.disabled : ''} ${selectedIdx===i ? styles.active : ''}`}
          disabled={used[i]}
          onClick={()=> selectIdx(i)}
          aria-pressed={selectedIdx===i}
          title={used[i] ? 'Used' : `Use ${n}`}>
          {n}
        </button>
      ))}
    </div>
  );
}
