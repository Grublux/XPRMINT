import { useGame } from '../../state/gameStore';
import styles from './SoundToggle.module.css';

export default function SoundToggle(){
  const { soundOn, toggleSound } = useGame();
  return (
    <button className={styles.btn} onClick={toggleSound} aria-pressed={soundOn} aria-label="Toggle sound">
      {soundOn ? '🔊 Sound On' : '🔈 Sound Off'}
    </button>
  );
}
