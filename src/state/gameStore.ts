import { create } from 'zustand';

type GameStatus = 'idle'|'active'|'win'|'timeout';
export type MoveItem = { delta:number; at:number };

const INITIAL_PACK_COST = 2000; // NGT
const SINGLE_NUMBER_COST = 500; // NGT
const MAX_NUMBERS = 3;

// TEST MODE: players never run out of NGT
const TEST_INFINITE_NGT = true;

function randNum1to500(){
  return Math.floor(Math.random()*500)+1;
}
function randTargetHz(){
  return Math.floor(Math.random()*10001); // 0..10000 Hz
}

function randResonanceHz(){
  return Math.floor(Math.random()*10001); // 0..10000 Hz
}

type GameState = {
  // core game
  targetHz: number;           // "Target Frequency"
  resonanceHz: number;        // "Specimen Resonance"
  pot: number;
  lastMoveAt: number;
  numbers: number[];
  used: boolean[];
  status: GameStatus;

  // ui/meta
  selectedIdx: number | null;
  recentMoves: MoveItem[];
  soundOn: boolean;

  // economy (mock)
  hasJoined: boolean;
  ngtBalance: number;
  initialPackCost: number;
  singleNumberCost: number;

  // actions
  setTarget:(hz:number)=>void;
  setResonance:(hz:number)=>void;
  setPot:(p:number)=>void;
  toggleSound:()=>void;
  selectIdx:(i:number|null)=>void;

  joinWithInitialPack:()=>void;
  canBuyNumber:()=>boolean;
  buyNumber:()=>void;

  play:(idx:number, dir:'add'|'sub')=>void;
  resetRound:()=>void;
};

export const useGame = create<GameState>((set, get)=>({
  // start in idle until join; random target in reset
  targetHz: randTargetHz(),
  resonanceHz: 10000, // TEST: Max orb size
  pot: 12000,
  lastMoveAt: Date.now(),
  numbers: [randNum1to500(), randNum1to500(), randNum1to500()],
  used: [false, false, false],
  status: 'active',

  selectedIdx: 0,
  recentMoves: [],
  soundOn: true,

  hasJoined: true,
  ngtBalance: 50_000, // high balance for testing
  initialPackCost: INITIAL_PACK_COST,
  singleNumberCost: SINGLE_NUMBER_COST,

  setTarget:(hz)=> set({ targetHz: hz }),
  setResonance:(hz)=> set({ resonanceHz: Math.max(0, Math.min(10000, hz)) }),
  setPot:(p)=> set({ pot: p }),
  toggleSound:()=> set(s => ({ soundOn: !s.soundOn })),
  selectIdx:(i)=> set({ selectedIdx: i }),

  joinWithInitialPack: ()=>{
    const s = get();
    if (s.hasJoined) return;
    if (!TEST_INFINITE_NGT && s.ngtBalance < s.initialPackCost) return;

    const newNumbers = [randNum1to500(), randNum1to500(), randNum1to500()];
    set({
      hasJoined: true,
      status: 'active',
      numbers: newNumbers,
      used: [false,false,false],
      ngtBalance: TEST_INFINITE_NGT ? s.ngtBalance : s.ngtBalance - s.initialPackCost,
      pot: Math.round(s.pot + 100),
      lastMoveAt: Date.now(),
      selectedIdx: 0,
      // fresh round: random target already set in state; keep it
      resonanceHz: 10000, // TEST: Max orb size
    });
  },

  canBuyNumber: ()=>{
    const s = get();
    if (!s.hasJoined) return false;
    if (s.numbers.length >= MAX_NUMBERS) return false;
    if (!TEST_INFINITE_NGT && s.ngtBalance < s.singleNumberCost) return false;
    return true;
  },

  buyNumber: ()=>{
    const s = get();
    if (!s.hasJoined) return;
    if (s.numbers.length >= MAX_NUMBERS) return;
    if (!TEST_INFINITE_NGT && s.ngtBalance < s.singleNumberCost) return;

    const newVal = randNum1to500();
    set({
      numbers: [...s.numbers, newVal],
      used:    [...s.used, false],
      ngtBalance: TEST_INFINITE_NGT ? s.ngtBalance : s.ngtBalance - s.singleNumberCost,
      pot: Math.round(s.pot + 50),
      lastMoveAt: Date.now()
    });
  },

  play:(idx,dir)=>{
    const s = get();
    if (!s.hasJoined || s.status!=='active') return;
    if (s.used[idx]) return;

    const n = s.numbers[idx];
    const delta = dir==='add' ? n : -n;
    const next = s.resonanceHz + delta;

    const newMoves = [{ delta, at: Date.now() }, ...s.recentMoves].slice(0,10);

    // remove the used number (so player can purchase new)
    const compactNumbers:number[] = [];
    const compactUsed:boolean[] = [];
    s.numbers.forEach((val,i)=>{
      if (i!==idx) { compactNumbers.push(val); compactUsed.push(s.used[i]); }
    });

    const win = (next === s.targetHz);
    set({
      resonanceHz: next,
      numbers: compactNumbers,
      used: compactUsed,
      lastMoveAt: Date.now(),
      pot: Math.round(s.pot + 25), // Increased from 10 to 25 - pot grows when frequency buttons are used
      status: win ? 'win' : s.status,
      recentMoves: newMoves,
      selectedIdx: null
    });
  },

  resetRound:()=> set({
    targetHz: randTargetHz(),
    resonanceHz: 10000, // TEST: Max orb size
    numbers: [randNum1to500(), randNum1to500(), randNum1to500()],
    used: [false, false, false],
    status: 'active',
    lastMoveAt: Date.now(),
    recentMoves: [],
    selectedIdx: 0,
    // keep ngtBalance as-is; TEST_INFINITE_NGT means it never depletes
  })
}));

