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
  const gradientIdRef = useRef(`lightningGradient-${Math.random().toString(36).substr(2, 9)}`);
  const filterIdRef = useRef(`glow-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Reset progress when new bolt is triggered
    setProgress(0);
    
    // Generate path once
    pathRef.current = generateLightningPath(from, to, 25);
    
    const duration = 400; // ms
    const start = Date.now();
    let rafId: number;
    
    const animate = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      
      if (p < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setTimeout(onComplete, 50);
      }
    };
    
    // Start animation immediately
    rafId = requestAnimationFrame(animate);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [from.x, from.y, to.x, to.y, onComplete]); // Include onComplete but it should be stable

  // Calculate visible path up to current position
  const totalSegments = pathRef.current.length - 1;
  const currentSegment = Math.floor(progress * totalSegments);
  const segmentProgress = (progress * totalSegments) - currentSegment;
  
  const visiblePath: {x: number, y: number}[] = [];
  
  if (pathRef.current.length > 0) {
    // Always include first point
    visiblePath.push(pathRef.current[0]);
    
    // Add all points up to current segment
    for (let i = 1; i <= currentSegment && i < pathRef.current.length; i++) {
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

  // Need at least 2 points to draw a line
  if (visiblePath.length < 2) {
    // If we have at least the start point, duplicate it so we can see something
    if (visiblePath.length === 1) {
      visiblePath.push({ x: visiblePath[0].x + 1, y: visiblePath[0].y + 1 });
    } else {
      return null;
    }
  }

  const pathData = `M ${visiblePath[0].x} ${visiblePath[0].y} ${visiblePath.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`;

  // Calculate gradient direction based on path direction
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const gradientX1 = from.x;
  const gradientY1 = from.y;
  const gradientX2 = to.x;
  const gradientY2 = to.y;

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
        zIndex: 9999, /* Very high z-index to ensure visibility */
      }}
    >
      <defs>
        <linearGradient 
          id={gradientIdRef.current} 
          x1={gradientX1} 
          y1={gradientY1} 
          x2={gradientX2} 
          y2={gradientY2}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="10%" stopColor="rgba(150,220,255,1)" />
          <stop offset="100%" stopColor="rgba(150,220,255,1)" />
        </linearGradient>
        <filter id={filterIdRef.current}>
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Main bright lightning bolt */}
      <path
        d={pathData}
        className={styles.bolt}
        style={{
          stroke: `url(#${gradientIdRef.current})`,
          filter: `url(#${filterIdRef.current})`,
          opacity: 1 - progress * 0.2, /* Less fade for better visibility */
        }}
      />
      {/* Additional brighter core for extra visibility - also with gradient intensity */}
      <path
        d={pathData}
        className={styles.bolt}
        style={{
          stroke: 'rgba(255,255,255,1)',
          strokeWidth: 4,
          opacity: (1 - progress * 0.2) * (0.2 + Math.min(progress * 8, 0.8)), // Start at 20% opacity, reach 100% by 10% of path
          filter: 'none',
        }}
      />
    </svg>
  );
}
