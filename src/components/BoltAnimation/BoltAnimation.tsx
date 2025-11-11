import { useEffect, useState, useRef } from 'react';
import styles from './BoltAnimation.module.css';

type BoltProps = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  onComplete: () => void;
};

// Generate jagged lightning path
function generateLightningPath(from: {x: number, y: number}, to: {x: number, y: number}, segments: number = 20) {
  const path: {x: number, y: number}[] = [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  path.push(from);
  
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const baseX = from.x + dx * t;
    const baseY = from.y + dy * t;
    
    // Perpendicular offset for jaggedness
    const perpAngle = angle + Math.PI / 2;
    const offset = (Math.random() - 0.5) * (distance / segments * 0.4);
    const offsetX = Math.cos(perpAngle) * offset;
    const offsetY = Math.sin(perpAngle) * offset;
    
    // Add some randomness along the path
    const jitterX = (Math.random() - 0.5) * (distance / segments * 0.3);
    const jitterY = (Math.random() - 0.5) * (distance / segments * 0.3);
    
    path.push({
      x: baseX + offsetX + jitterX,
      y: baseY + offsetY + jitterY
    });
  }
  
  path.push(to);
  return path;
}

export default function BoltAnimation({ from, to, onComplete }: BoltProps) {
  const [progress, setProgress] = useState(0);
  const pathRef = useRef<{x: number, y: number}[]>([]);

  useEffect(() => {
    // Generate path once
    pathRef.current = generateLightningPath(from, to, 25);
    
    const duration = 400; // ms - slowed down from 200
    const start = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      
      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(onComplete, 50);
      }
    };
    
    requestAnimationFrame(animate);
  }, [from, to, onComplete]);

  // Calculate visible path up to current position
  const totalSegments = pathRef.current.length - 1;
  const currentSegment = Math.floor(progress * totalSegments);
  const segmentProgress = (progress * totalSegments) - currentSegment;
  
  const visiblePath: {x: number, y: number}[] = [];
  
  if (pathRef.current.length > 0) {
    // Add all points up to current segment
    for (let i = 0; i <= currentSegment && i < pathRef.current.length; i++) {
      visiblePath.push(pathRef.current[i]);
    }
    
    // Add interpolated point for current segment
    if (currentSegment < pathRef.current.length - 1 && segmentProgress > 0) {
      const p1 = pathRef.current[currentSegment];
      const p2 = pathRef.current[currentSegment + 1];
      visiblePath.push({
        x: p1.x + (p2.x - p1.x) * segmentProgress,
        y: p1.y + (p2.y - p1.y) * segmentProgress
      });
    }
  }

  if (visiblePath.length < 2) return null;

  const pathData = `M ${visiblePath[0].x} ${visiblePath[0].y} ${visiblePath.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`;

  return (
    <svg 
      className={styles.boltContainer}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <defs>
        <linearGradient id="lightningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,1)" />
          <stop offset="50%" stopColor="rgba(150,220,255,0.95)" />
          <stop offset="100%" stopColor="rgba(100,180,255,0.9)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path
        d={pathData}
        className={styles.bolt}
        style={{
          opacity: 1 - progress * 0.4,
        }}
      />
    </svg>
  );
}
