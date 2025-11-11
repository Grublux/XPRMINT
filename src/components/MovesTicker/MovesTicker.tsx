import { useEffect, useRef, useMemo } from 'react';
import { useGame } from '../../state/gameStore';
import styles from './MovesTicker.module.css';
import { nearChime } from '../../lib/audio';

const NEAR_WINDOW = 100; // Hz threshold for 0-10000 range
const SCROLL_SPEED = 60; // pixels per second

type TopPlayer = {
  rank: number;
  username: string;
  frequency: number;
  distance: number; // How close to target (absolute difference)
};

export default function MovesTicker(){
  const { resonanceHz, targetHz, soundOn } = useGame();
  const prevDist = useRef<number>(Math.abs(targetHz - resonanceHz));
  const tickerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(()=>{
    const d = Math.abs(targetHz - resonanceHz);
    // chime when entering near window
    if (soundOn && prevDist.current > NEAR_WINDOW && d <= NEAR_WINDOW){
      nearChime();
    }
    prevDist.current = d;
  }, [resonanceHz, targetHz, soundOn]);

  // Generate top 7 players with "Me" randomly placed
  const topPlayers: TopPlayer[] = useMemo(() => {
    const playerNames = [
      'QuantumResonator',
      'FrequencyMaster',
      'HzHunter',
      'WaveRider',
      'SpectrumSeeker',
      'TuneWizard',
      'ResonancePro'
    ];
    
    // Generate 6 random players
    const randomPlayers: TopPlayer[] = [];
    const usedIndices = new Set<number>();
    
    // Pick 6 random names
    for (let i = 0; i < 6; i++) {
      let idx;
      do {
        idx = Math.floor(Math.random() * playerNames.length);
      } while (usedIndices.has(idx));
      usedIndices.add(idx);
      
      // Generate random frequency (0-10000)
      const frequency = Math.floor(Math.random() * 10000);
      const distance = Math.abs(frequency - targetHz);
      
      randomPlayers.push({
        rank: 0, // Will be set after sorting
        username: playerNames[idx],
        frequency,
        distance
      });
    }
    
    // Add "Me" player
    const mePlayer: TopPlayer = {
      rank: 0,
      username: 'Me',
      frequency: resonanceHz,
      distance: Math.abs(resonanceHz - targetHz)
    };
    
    // Combine and sort by distance (closest first)
    const allPlayers = [...randomPlayers, mePlayer].sort((a, b) => a.distance - b.distance);
    
    // Assign ranks and take top 7
    return allPlayers.slice(0, 7).map((player, index) => ({
      ...player,
      rank: index + 1
    }));
  }, [resonanceHz, targetHz]);

  // Color for rank (green for 1, red for 7, gradient in between)
  const getRankColor = (rank: number) => {
    if (rank <= 7) {
      // Interpolate from green (rank 1) to red (rank 7)
      const ratio = (rank - 1) / 6; // 0 to 1
      const r = Math.floor(34 + (255 - 34) * ratio); // 34 (green) to 255 (red)
      const g = Math.floor(197 + (59 - 197) * ratio); // 197 (green) to 59 (red)
      const b = Math.floor(96 + (59 - 96) * ratio); // 96 (green) to 59 (red)
      return `rgb(${r}, ${g}, ${b})`;
    }
    return 'var(--muted)'; // Gray for almost players
  };

  // Continuous scrolling animation - runs continuously, never resets
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000; // seconds
      lastUpdateRef.current = now;

      // Continuously scroll left
      scrollPositionRef.current -= SCROLL_SPEED * deltaTime;
      
      // Get the width of one set of content
      const contentWidth = ticker.scrollWidth / 3; // We have 3 sets of content
      
      // Reset position when we've scrolled through one full set (seamless loop)
      if (contentWidth > 0 && Math.abs(scrollPositionRef.current) >= contentWidth) {
        scrollPositionRef.current += contentWidth;
      }

      ticker.style.transform = `translateX(${scrollPositionRef.current}px)`;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    lastUpdateRef.current = Date.now();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []); // Run once on mount, scroll continuously

  return (
    <div className={styles.tickerContainer} aria-live="polite" aria-atomic="true">
      <div className={styles.tickerTrack}>
        <div ref={tickerRef} className={styles.tickerContent}>
          {/* Render 3 sets for seamless continuous scrolling */}
          {[1, 2, 3].map((set) => (
            topPlayers.map((player) => (
              <div 
                key={`${set}-${player.rank}-${player.username}`}
                className={`${styles.tickerItem} ${player.username === 'Me' ? styles.meRow : ''}`}
              >
                <span 
                  className={styles.rank} 
                  style={{ color: getRankColor(player.rank) }}
                >
                  #{player.rank}
                </span>
                <span className={styles.username}>{player.username}</span>
                <span className={styles.frequency}>{Math.round(player.frequency)} Hz</span>
                <span className={styles.distance}>±{Math.round(player.distance)}</span>
              </div>
            ))
          ))}
        </div>
      </div>
    </div>
  );
}
