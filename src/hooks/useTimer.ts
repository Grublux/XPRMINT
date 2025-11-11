import { useEffect, useState } from 'react';
export function useTimer(lastMoveAt:number, windowMs=600_000){
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{
    let raf:number;
    const tick=()=>{ setNow(Date.now()); raf=requestAnimationFrame(tick); };
    raf=requestAnimationFrame(tick);
    return ()=> cancelAnimationFrame(raf);
  },[]);
  const elapsed = now - lastMoveAt;
  const remaining = Math.max(0, windowMs - elapsed);
  const mm = Math.floor(remaining/60000).toString().padStart(2,'0');
  const ss = Math.floor((remaining%60000)/1000).toString().padStart(2,'0');
  return { remaining, label:`${mm}:${ss}` };
}


