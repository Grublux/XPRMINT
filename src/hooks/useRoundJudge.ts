import { useEffect } from 'react';
import { useGame } from '../state/gameStore';

export function useRoundJudge(windowMs = 600_000) {
  const { lastMoveAt, status } = useGame();
  useEffect(() => {
    if (status !== 'active') return;
    let raf = 0;
    const tick = () => {
      const remaining = Math.max(0, windowMs - (Date.now() - lastMoveAt));
      if (remaining === 0) {
        // TODO: compute Closest-7 snapshot here
        useGame.setState({ status: 'timeout' });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lastMoveAt, status, windowMs]);
}


