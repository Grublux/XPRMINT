import { useGame } from '../../state/gameStore';
import styles from './NumberChips.module.css';

export default function NumberChips(){
  const { numbers, used, selectedIdx, selectIdx } = useGame();
  
  // Always show 3 slots (max capacity) to prevent layout shifts
  const slots = Array.from({ length: 3 }, (_, i) => {
    if (i < numbers.length) {
      return { value: numbers[i], used: used[i], index: i };
    }
    return { value: null, used: false, index: null };
  });
  
  return (
    <div className={styles.row} role="group" aria-label="Choose a number">
      {slots.map((slot, i) => (
        <button 
          key={i}
          className={`${styles.chip} ${slot.value === null ? styles.placeholder : ''} ${slot.used ? styles.disabled : ''} ${selectedIdx === slot.index ? styles.active : ''}`}
          disabled={slot.value === null || slot.used}
          onClick={() => slot.index !== null && selectIdx(slot.index)}
          aria-pressed={selectedIdx === slot.index}
          title={slot.value === null ? 'Empty' : slot.used ? 'Used' : `Use ${slot.value}`}
        >
          {slot.value !== null ? slot.value : '\u00A0'}
        </button>
      ))}
    </div>
  );
}
