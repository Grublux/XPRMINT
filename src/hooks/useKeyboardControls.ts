import { useEffect } from 'react';
import { useGame } from '../state/gameStore';
import { click } from '../lib/audio';
import { buzz } from '../lib/haptics';

export function useKeyboardControls(){
  const { selectedIdx, selectIdx, play, status, used } = useGame();

  useEffect(()=>{
    function onKey(e: KeyboardEvent){
      if (status !== 'active') return;

      // select chip: 1,2,3
      if (e.key === '1') { selectIdx(0); buzz(8); return; }
      if (e.key === '2') { selectIdx(1); buzz(8); return; }
      if (e.key === '3') { selectIdx(2); buzz(8); return; }

      // add/sub with +/-
      if ((e.key === '+' || e.key === '=') && selectedIdx !== null && !used[selectedIdx]){
        play(selectedIdx,'add'); click(); return;
      }
      if ((e.key === '-' ) && selectedIdx !== null && !used[selectedIdx]){
        play(selectedIdx,'sub'); click(); return;
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [selectedIdx, selectIdx, play, status, used]);
}
