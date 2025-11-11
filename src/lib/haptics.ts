export function buzz(ms=12){ if (navigator.vibrate) navigator.vibrate(ms); }
export function buzzWin(){ if (navigator.vibrate) navigator.vibrate([30,40,60]); }
