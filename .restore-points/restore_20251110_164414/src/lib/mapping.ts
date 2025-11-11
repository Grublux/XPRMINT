export const clamp = (v:number,a:number,b:number)=> Math.max(a, Math.min(b,v));
export const map = (v:number,inMin:number,inMax:number,outMin:number,outMax:number)=>{
  const t = (v - inMin) / (inMax - inMin);
  return outMin + clamp(t,0,1)*(outMax - outMin);
};

