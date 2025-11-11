import HeaderBar from '../components/HeaderBar/HeaderBar';
import TargetFrequency from '../components/TargetFrequency/TargetFrequency';
import CreatureCanvas from '../components/CreatureCanvas/CreatureCanvas';
import Controls from '../components/Controls/Controls';
import UpButton from '../components/ActionButtons/UpButton';
import DownButton from '../components/ActionButtons/DownButton';
import WinOverlay from '../components/Overlays/WinOverlay';
import TimeoutOverlay from '../components/Overlays/TimeoutOverlay';
import JoinOverlay from '../components/Overlays/JoinOverlay';
import MovesTicker from '../components/MovesTicker/MovesTicker';
import SoundToggle from '../components/SoundToggle/SoundToggle';
import { useRoundJudge } from '../hooks/useRoundJudge';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import styles from './ExperimentPage.module.css';

export default function ExperimentPage(){
  useRoundJudge();
  useKeyboardControls();

  return (
    <div className={styles.grid}>
      <div className={styles.topRow}>
        <HeaderBar/>
        <SoundToggle/>
      </div>

      <TargetFrequency/>
      <MovesTicker/>
      
      <div className={styles.specimenRow}>
        <UpButton/>
        <CreatureCanvas/>
        <DownButton/>
      </div>
      
      <Controls/>

      {/* Overlays */}
      <JoinOverlay/>
      <WinOverlay/>
      <TimeoutOverlay/>
    </div>
  );
}
