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
  if(!Ctx) return; const ctx = new Ctx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type='triangle'; o.frequency.value = 660;
  g.gain.setValueAtTime(0.0008, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime+0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.25);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.26);
}

export function winSound(){
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if(!Ctx) return; const ctx = new Ctx();
  const freqs = [523.25, 659.25, 783.99]; // C5 E5 G5
  freqs.forEach((f,i)=>{
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0008, ctx.currentTime + i*0.05);
    g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + i*0.05 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i*0.05 + 0.35);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i*0.05); o.stop(ctx.currentTime + i*0.05 + 0.36);
  });
}
