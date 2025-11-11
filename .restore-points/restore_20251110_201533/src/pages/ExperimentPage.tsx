import HeaderBar from '../components/HeaderBar/HeaderBar';
import TitleHeader from '../components/TitleHeader/TitleHeader';
import TargetFrequency from '../components/TargetFrequency/TargetFrequency';
import CreatureCanvas from '../components/CreatureCanvas/CreatureCanvas';
import FrequencyReadout from '../components/FrequencyReadout/FrequencyReadout';
import CenterDial from '../components/CenterDial/CenterDial';
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
      <TitleHeader/>
      <div className={styles.topRow}>
        <HeaderBar/>
        <SoundToggle/>
      </div>

      <TargetFrequency/>
      <MovesTicker/>
      
      <div className={styles.specimenRow}>
        <CreatureCanvas/>
      </div>
      
      <div className={styles.dialRow}>
        <FrequencyReadout direction="down"/>
        <CenterDial/>
        <FrequencyReadout direction="up"/>
      </div>

      {/* Overlays */}
      <JoinOverlay/>
      <WinOverlay/>
      <TimeoutOverlay/>
    </div>
  );
}
