import { useGame } from '../../state/gameStore';
import { click } from '../../lib/audio';
import { buzz } from '../../lib/haptics';
import styles from './ActionButtons.module.css';

export default function ActionButtons(){
  const { play, status, selectedIdx, used } = useGame();
  const disabled = status!=='active' || selectedIdx===null || (selectedIdx!==null && used[selectedIdx]);

  const doPlay = (dir:'add'|'sub')=>{
    if (disabled || selectedIdx===null) return;
    play(selectedIdx, dir); click(); buzz(10);
  };

  return (
    <div className={styles.container}>
      <button 
        className={styles.btn} 
        disabled={disabled} 
        onClick={()=> doPlay('add')}
        aria-label="Increase resonance"
      >
        UP ↑
      </button>
      <button 
        className={styles.btn} 
        disabled={disabled} 
        onClick={()=> doPlay('sub')}
        aria-label="Decrease resonance"
      >
        DOWN ↓
      </button>
    </div>
  );
}
