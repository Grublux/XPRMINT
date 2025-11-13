import { useGame } from '../../state/gameStore';
import styles from './NumberChips.module.css';

export default function NumberChips(){
  const { numbers, used, selectedIdx, selectIdx } = useGame();
  
  // Always show 3 slots (max capacity) to prevent layout shifts
  // Placeholders must always be visible even when there are fewer numbers
  const slots = Array.from({ length: 3 }, (_, i) => {
    if (i < numbers.length && numbers[i] !== undefined) {
      return { value: numbers[i], used: used[i] || false, index: i };
    }
    // Always return placeholder for empty slots
    return { value: null, used: false, index: null };
  });
  
  return (
    <div className={styles.row} role="group" aria-label="Choose a number">
      {slots.map((slot, i) => {
        const isPlaceholder = slot.value === null;
        return (
          <button 
            key={`slot-${i}`}
            className={`${styles.chip} ${isPlaceholder ? styles.placeholder : ''} ${slot.used ? styles.disabled : ''} ${selectedIdx === slot.index ? styles.active : ''}`}
            disabled={isPlaceholder || slot.used}
            onClick={() => slot.index !== null && selectIdx(slot.index)}
            aria-pressed={selectedIdx === slot.index}
            title={isPlaceholder ? 'Empty' : slot.used ? 'Used' : `Use ${slot.value}`}
          >
            {isPlaceholder ? '\u00A0' : slot.value}
          </button>
        );
      })}
    </div>
  );
}
