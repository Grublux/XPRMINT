export function click(){
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if(!Ctx) return;
  const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = 420;
  g.gain.setValueAtTime(0.001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.12);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.14);
}

export function nearChime(){
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if(!Ctx) return;
  const ctx = new Ctx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = 660;
  g.gain.setValueAtTime(0.001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime+0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.3);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime+0.35);
}

export function winSound(){
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if(!Ctx) return;
  const ctx = new Ctx();
  
  // Play a 3-note chord
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.1);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.1 + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + i * 0.1);
    o.stop(ctx.currentTime + i * 0.1 + 0.5);
  });
}

