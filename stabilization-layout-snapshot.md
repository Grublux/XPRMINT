# Stabilization Frontend Layout Snapshot

This document provides a complete snapshot of the current Stabilization frontend layout for integration of a Goob selector & lab UI. The stabilization system runs on `/experiment` page.

**Generated:** 2024-11-23
**Route:** `http://localhost:3000/experiment`

---

## src/main.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import App from './App';
import { preloadAllImages } from './utils/preloadImages';
import { wagmiConfig } from './config/wagmiConfig';

// Preload all images immediately when app starts
preloadAllImages();

// Create a query client for React Query (required by wagmi)
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
```

---

## src/App.tsx

```tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import './styles/globals.css';

export default function App(){ return <RouterProvider router={router}/>; }
```

---

## src/routes.tsx

```tsx
import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import HomePage from './pages/HomePage';
import ExperimentPage from './pages/ExperimentPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout/>,
    children: [
      { index: true, element: <HomePage/> },
      { path: 'experiment', element: <ExperimentPage/> },
    ],
  },
]);
```

---

## src/pages/ExperimentPage.tsx

```tsx
import { useState } from 'react';
import CreatureCanvas from '../components/CreatureCanvas/CreatureCanvas';
import FrequencyReadout, { PlusButton } from '../components/FrequencyReadout/FrequencyReadout';
import CenterDial from '../components/CenterDial/CenterDial';
import WinOverlay from '../components/Overlays/WinOverlay';
// import TimeoutOverlay from '../components/Overlays/TimeoutOverlay'; // Commented out - timeout feature removed
import JoinOverlay from '../components/Overlays/JoinOverlay';
import { useRoundJudge } from '../hooks/useRoundJudge';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useGame } from '../state/gameStore';
import styles from './ExperimentPage.module.css';

export default function ExperimentPage(){
  useRoundJudge();
  useKeyboardControls();
  const { resonanceHz, setResonance } = useGame();
  const [selectedCreature, setSelectedCreature] = useState('Slime');
  
  // Orb size slider logic
  const sliderValue = 0.1 + (resonanceHz / 10000) * 1.9;
  const sizePercent = (resonanceHz / 10000) * 100;
  const handleSliderChange = (value: number) => {
    const newResonance = ((value - 0.1) / 1.9) * 10000;
    setResonance(Math.max(0, Math.min(10000, newResonance)));
  };

  return (
    <div className={styles.grid}>
      <div className={styles.specimenRow}>
        <CreatureCanvas creature={selectedCreature}/>
      </div>
      
      <div className={styles.dialRow}>
        <FrequencyReadout/>
        <CenterDial/>
        <PlusButton/>
      </div>

      <div className={styles.sliderRow}>
        <div className={styles.sizeControl}>
          <label htmlFor="orb-size" className={styles.sizeLabel}>
            Orb Size: {sizePercent.toFixed(0)}% ({Math.round(resonanceHz)} Hz)
          </label>
          <input
            id="orb-size"
            type="range"
            min="0.1"
            max="2.0"
            step="0.01"
            value={sliderValue}
            onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
            className={styles.sizeSlider}
          />
        </div>
        <div className={styles.creatureControl}>
          <label htmlFor="creature-select" className={styles.creatureLabel}>
            Creature
          </label>
          <select
            id="creature-select"
            value={selectedCreature}
            onChange={(e) => setSelectedCreature(e.target.value)}
            className={styles.creatureSelect}
          >
            <option value="Ruevee">Ruevee</option>
            <option value="Rose">Rose</option>
            <option value="Slime">Slime</option>
            <option value="Bob">Bob</option>
          </select>
        </div>
      </div>

      {/* Overlays */}
      <JoinOverlay/>
      <WinOverlay/>
      {/* <TimeoutOverlay/> */} {/* Commented out - timeout feature removed */}
    </div>
  );
}
```

---

## src/layout/AppLayout.tsx

```tsx
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import HamburgerMenu from '../components/HamburgerMenu/HamburgerMenu';
import HowToPlayOverlay from '../components/Overlays/HowToPlayOverlay';
import styles from './AppLayout.module.css';

export default function AppLayout(){
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleText}>XPRMINT</div>
          <div className={styles.headerRight}>
            <button className={styles.walletButton}>Connect Wallet</button>
            <HamburgerMenu onHowToPlayClick={() => setShowHowToPlay(true)} />
          </div>
        </div>
      </header>
      <main className={styles.main}><Outlet/></main>
      <HowToPlayOverlay isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}
```

---

## src/config/wagmiConfig.ts

```ts
import { http, createConfig } from 'wagmi';
import { apechain } from './chains/apechain';

export const wagmiConfig = createConfig({
  chains: [apechain],
  transports: {
    [apechain.id]: http('https://apechain.calderachain.xyz/http'),
  },
});
```

---

## src/config/chains/apechain.ts

```ts
import { defineChain } from 'viem';

export const apechain = defineChain({
  id: 33139,
  name: 'ApeChain',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://apechain.calderachain.xyz/http'],
    },
    public: {
      http: ['https://apechain.calderachain.xyz/http'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ApeScan',
      url: 'https://apescan.io',
    },
  },
});
```

---

## src/config/contracts/stabilizationV3.ts

```ts
import type { Address } from 'viem';
// Import ABIs from Foundry artifacts
// @ts-ignore - Foundry JSON artifacts
import stabArtifact from '../../../out/CreatureStabilizer.sol/CreatureStabilizer.json';
// @ts-ignore - Foundry JSON artifacts
import itemArtifact from '../../../out/ItemToken1155.sol/ItemToken1155.json';

export const STAB_V3_ADDRESS: Address = '0xe5fb969eec4985e8EB92334fFE11EA45035467CB';
export const ITEM_V3_ADDRESS: Address = '0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8';

export const creatureStabilizerV3Abi = stabArtifact.abi;
export const itemToken1155V3Abi = itemArtifact.abi;

// Minimal mirror of the on-chain CreatureState struct for typing.
export type CreatureState = {
  vibes: number;                // uint8
  lockedCount: number;          // uint8
  targetSal: number;            // uint16
  targetPH: number;             // uint16
  targetTemp: number;           // uint16
  targetFreq: number;           // uint16
  currSal: number;              // uint16
  currPH: number;               // uint16
  currTemp: number;             // uint16
  currFreq: number;             // uint16
  lockedSal: boolean;
  lockedPH: boolean;
  lockedTemp: boolean;
  lockedFreq: boolean;
  stabilizedAt: bigint;         // uint40
  consecutiveVibeMax: number;   // uint16
  enhancedDrip: boolean;
  bondedSP: number;             // uint16
};
```

---

## src/hooks/stabilizationV3/index.ts

```ts
// Export all V3 stabilization hooks for convenient importing
export { useCreatureState } from './useCreatureState';
export { useWalletSP } from './useWalletSP';
export { useDailyItems } from './useDailyItems';
export type { DailyItems } from './useDailyItems';
export { useItemBalance } from './useItemBalance';
export { useInitializeCreature } from './useInitializeCreature';
export type { InitializeCreatureArgs } from './useInitializeCreature';
export { useClaimDailyItems } from './useClaimDailyItems';
export { useApplyItem } from './useApplyItem';
export { useBurnItemForSP } from './useBurnItemForSP';
export { useSendVibes } from './useSendVibes';
export { useLockTrait } from './useLockTrait';
```

---

## src/hooks/stabilizationV3/useCreatureState.ts

```ts
import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';
import type { CreatureState } from '../../config/contracts/stabilizationV3';

export function useCreatureState(creatureId: bigint | number) {
  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'getCreatureState',
    args: [BigInt(creatureId)],
  });

  const parsed: CreatureState | null = useMemo(() => {
    if (!data) return null;
    const [
      vibes,
      lockedCount,
      targetSal,
      targetPH,
      targetTemp,
      targetFreq,
      currSal,
      currPH,
      currTemp,
      currFreq,
      lockedSal,
      lockedPH,
      lockedTemp,
      lockedFreq,
      stabilizedAt,
      consecutiveVibeMax,
      enhancedDrip,
      bondedSP,
    ] = data as any[];

    return {
      vibes: Number(vibes),
      lockedCount: Number(lockedCount),
      targetSal: Number(targetSal),
      targetPH: Number(targetPH),
      targetTemp: Number(targetTemp),
      targetFreq: Number(targetFreq),
      currSal: Number(currSal),
      currPH: Number(currPH),
      currTemp: Number(currTemp),
      currFreq: Number(currFreq),
      lockedSal: Boolean(lockedSal),
      lockedPH: Boolean(lockedPH),
      lockedTemp: Boolean(lockedTemp),
      lockedFreq: Boolean(lockedFreq),
      stabilizedAt: BigInt(stabilizedAt),
      consecutiveVibeMax: Number(consecutiveVibeMax),
      enhancedDrip: Boolean(enhancedDrip),
      bondedSP: Number(bondedSP),
    } satisfies CreatureState;
  }, [data]);

  return {
    state: parsed,
    isLoading,
    isError,
    error,
    refetch,
  };
}
```

---

## src/hooks/stabilizationV3/useClaimDailyItems.ts

```ts
import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useClaimDailyItems() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const claim = useCallback(
    async (creatureId: bigint | number) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'claimDailyItems',
        args: [BigInt(creatureId)],
      });
    },
    [writeContract]
  );

  return {
    claim,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}
```

---

## src/hooks/stabilizationV3/useBurnItemForSP.ts

```ts
import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useBurnItemForSP() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const burnForSP = useCallback(
    async (creatureId: bigint | number, itemId: bigint | number) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'burnItemForSP',
        args: [BigInt(creatureId), BigInt(itemId)],
      });
    },
    [writeContract]
  );

  return {
    burnForSP,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}
```

---

## src/hooks/stabilizationV3/useLockTrait.ts

```ts
import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

// traitIndex: 0 = sal, 1 = pH, 2 = temp, 3 = freq
export function useLockTrait() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const lockTrait = useCallback(
    async (creatureId: bigint | number, traitIndex: 0 | 1 | 2 | 3) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'lockTrait',
        args: [BigInt(creatureId), traitIndex],
      });
    },
    [writeContract]
  );

  return {
    lockTrait,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}
```

---

## src/hooks/stabilizationV3/useApplyItem.ts

```ts
import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useApplyItem() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const applyItem = useCallback(
    async (creatureId: bigint | number, itemId: bigint | number) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'applyItem',
        args: [BigInt(creatureId), BigInt(itemId)],
      });
    },
    [writeContract]
  );

  return {
    applyItem,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}
```

---

## src/hooks/stabilizationV3/useSendVibes.ts

```ts
import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useSendVibes() {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const sendVibes = useCallback(
    async (creatureId: bigint | number) => {
      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'sendVibes',
        args: [BigInt(creatureId)],
      });
    },
    [writeContract]
  );

  return {
    sendVibes,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
  };
}
```

---

## src/hooks/stabilizationV3/useDailyItems.ts

```ts
// src/hooks/stabilizationV3/useDailyItems.ts
import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export type DailyItems = {
  day: number;
  ids: bigint[];
  amounts: bigint[];
};

export function useDailyItems(creatureId: bigint | number) {
  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'getDailyItems',
    args: [BigInt(creatureId)],
  });

  const parsed: DailyItems | null = useMemo(() => {
    if (!data) return null;
    const [day, ids, amounts] = data as [bigint, bigint[], bigint[]];

    return {
      day: Number(day),
      ids: ids || [],
      amounts: amounts || [],
    };
  }, [data]);

  return {
    dailyItems: parsed,
    isLoading,
    isError,
    error,
    refetch,
  };
}
```

---

## src/hooks/stabilizationV3/useInitializeCreature.ts

```ts
import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export type InitializeCreatureArgs = {
  creatureId: bigint | number;
  targetSal: number;
  targetPH: number;
  targetTemp: number;
  targetFreq: number;
  currSal: number;
  currPH: number;
  currTemp: number;
  currFreq: number;
};

export function useInitializeCreature() {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const [submitted, setSubmitted] = useState(false);

  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const initialize = useCallback(
    async (args: InitializeCreatureArgs) => {
      if (!address) throw new Error('Wallet not connected');
      setSubmitted(false);

      await writeContract({
        address: STAB_V3_ADDRESS,
        abi: creatureStabilizerV3Abi,
        functionName: 'initializeCreature',
        args: [
          BigInt(args.creatureId),
          args.targetSal,
          args.targetPH,
          args.targetTemp,
          args.targetFreq,
          args.currSal,
          args.currPH,
          args.currTemp,
          args.currFreq,
        ],
      });

      setSubmitted(true);
    },
    [address, writeContract]
  );

  return {
    initialize,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError ?? txError,
    submitted,
  };
}
```

---

## src/hooks/stabilizationV3/useItemBalance.ts

```ts
import { useAccount, useReadContract } from 'wagmi';
import { ITEM_V3_ADDRESS, itemToken1155V3Abi } from '../../config/contracts/stabilizationV3';

export function useItemBalance(tokenId: bigint | number, addressOverride?: `0x${string}`) {
  const { address } = useAccount();
  const target = addressOverride ?? address;

  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: ITEM_V3_ADDRESS,
    abi: itemToken1155V3Abi,
    functionName: 'balanceOf',
    args: target ? [target, BigInt(Number(tokenId))] : undefined,
    query: {
      enabled: !!target,
    },
  });

  return {
    balance: data ? (typeof data === 'bigint' ? data : BigInt(String(data))) : 0n,
    isLoading,
    isError,
    error,
    refetch,
  };
}
```

---

## src/hooks/stabilizationV3/useWalletSP.ts

```ts
import { useAccount, useReadContract } from 'wagmi';
import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from '../../config/contracts/stabilizationV3';

export function useWalletSP(addressOverride?: `0x${string}`) {
  const { address } = useAccount();
  const target = addressOverride ?? address;

  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: 'walletSP',
    args: target ? [target] : undefined,
    query: {
      enabled: !!target,
    },
  });

  return {
    sp: data ? Number(data) : 0,
    isLoading,
    isError,
    error,
    refetch,
  };
}
```

---

## src/pages/ExperimentPage.module.css

```css
.grid{ 
  display:grid; 
  gap:0; /* Remove gap to create uniform background */
  grid-template-columns:1fr; 
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0 16px;
  box-sizing: border-box;
  overflow-x: hidden; /* Prevent horizontal scrolling */
}
.topRow{ display:flex; gap:12px; align-items:center; justify-content:space-between; }
.titleRow {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  width: 90%;
  max-width: 900px;
  margin: 0 auto;
  padding: 12px 0;
  box-sizing: border-box;
  flex-wrap: nowrap;
}

.titleLeft {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
}

.howToPlayLink {
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  opacity: 0.8;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.howToPlayLink:hover {
  opacity: 1;
  text-decoration: underline;
}

.titleCenter {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.titleText {
  font-size: 21.6px;
  font-weight: 900;
  letter-spacing: 1.8px;
  color: var(--gold);
  text-transform: uppercase;
  margin: 0;
  text-align: center;
}

.titleRight {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.walletButton {
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 200, 100, 0.15));
  border: 1px solid rgba(0, 255, 136, 0.4);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 0 8px rgba(0, 255, 136, 0.2);
}

.walletButton:hover {
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.3), rgba(0, 200, 100, 0.25));
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.4);
  transform: translateY(-1px);
}
.specimenRow{ 
  display:flex; 
  gap:16px; 
  align-items:stretch; 
  justify-content:center; 
  width: 90%; /* Take up 90% of viewport width */
  max-width: 900px; /* Cap at 900px when too wide */
  margin: 0 auto; /* Center the row */
  margin-bottom: 0; /* Remove bottom margin to eliminate gap */
  box-sizing: border-box;
  flex-wrap: nowrap;
  position: relative; /* For absolute positioning of MovesTicker */
  overflow-x: hidden; /* Prevent horizontal scrolling */
}

.potSection {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3.6px;
  padding: 12.6px 10.8px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 193, 7, 0.1));
  border-radius: var(--radius);
  border: 2px solid rgba(255, 215, 0, 0.4);
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.3), inset 0 0 8px rgba(255, 215, 0, 0.1);
  flex: 0 1 auto;
  min-width: 0;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.titleSection {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
}

.title {
  font-size: 21.6px;
  font-weight: 900;
  letter-spacing: 1.8px;
  color: var(--gold);
  text-transform: uppercase;
  margin: 0;
  text-align: center;
}

.potSection::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%);
  animation: pulse 3s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

.potLabel {
  font-size: 11.7px;
  color: rgba(255, 215, 0, 0.9);
  text-align: left;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
  position: relative;
  z-index: 1;
}

.potValue {
  font-size: 24px;
  color: #FFD700;
  text-align: left;
  font-weight: 900;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 1;
  letter-spacing: 0.5px;
}

.timerSection {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3.6px;
  padding: 10.8px 9px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius);
  border: 1px solid rgba(255, 255, 255, 0.05);
  flex: 0 1 auto;
  min-width: 0;
  box-sizing: border-box;
}

.timerLabel {
  font-size: 10.8px;
  color: var(--muted);
  text-align: right;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.timerValue {
  font-size: 18px;
  color: var(--text);
  text-align: right;
  font-weight: 700;
}

.timerDanger {
  color: #e87474;
  animation: blink 0.8s steps(2, start) infinite;
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
.specimenRow > *:nth-child(1) {
  flex: 0 0 auto; /* Don't grow, use fixed width */
  min-width: 0;
  box-sizing: border-box;
  /* Will be centered by parent's justify-content: center */
}
.specimenRow > *:nth-child(2) {
  position: absolute; /* Position absolutely so it doesn't affect centering */
  right: 0;
  top: 0;
  bottom: 0;
  width: 200px;
  max-width: 25%;
  min-width: 0;
  box-sizing: border-box;
}

.dialRow {
  display: flex;
  gap: calc(16px * (550px * 932 / 1127) / 752px); /* Scale gap proportionally */
  align-items: center; /* Center items vertically */
  justify-content: center;
  flex-wrap: nowrap;
  width: 90%; /* Take up 90% of viewport width */
  max-width: 900px; /* Cap at 900px when too wide */
  margin: 0 auto; /* Center the row */
  margin-top: -1px; /* Pull up to connect with specimen area */
  box-sizing: border-box;
  overflow-x: hidden; /* Prevent horizontal scrolling */
  overflow-y: visible; /* Allow vertical expansion to show all content */
  background: var(--panel) !important; /* Shared background to match specimen area */
  border-radius: 0; /* Remove all border radius to connect seamlessly */
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: var(--radius); /* Match specimen top radius */
  border-bottom-right-radius: var(--radius);
  border-top: none; /* No top border - connects to specimen area */
  border-left: 1px solid rgba(255, 255, 255, 0.3); /* Match selected button and specimen area border opacity */
  border-right: 1px solid rgba(255, 255, 255, 0.3); /* Match selected button and specimen area border opacity */
  border-bottom: 1px solid rgba(255, 255, 255, 0.3); /* Match selected button and specimen area border opacity */
  padding: 10.8px; /* Match specimen area padding */
  padding-top: 0; /* Remove top padding so anode/cathode are at very top */
  box-shadow: 0 10px 30px rgba(0,0,0,.35); /* Match specimen area shadow exactly */
}

.sliderRow {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 9px;
  padding: 9px 16px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin-top: 18px; /* Add margin to prevent overlap with buy button */
}

.sizeControl {
  display: flex;
  flex-direction: column;
  gap: 3.6px;
  align-items: center;
  min-width: 200px;
  max-width: 400px;
  width: 100%;
}

.sizeLabel {
  font-size: 11.7px;
  color: var(--muted);
  font-weight: 500;
}


.creatureControl {
  display: flex;
  flex-direction: column;
  gap: 3.6px;
  align-items: center;
  min-width: 150px;
  max-width: 250px;
  width: 100%;
}

.creatureLabel {
  font-size: 11.7px;
  color: var(--muted);
  font-weight: 500;
}

.creatureSelect {
  width: 100%;
  padding: 6px 12px;
  background: var(--panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 10.5px; /* Reduced from 11.7px to make "Rose" slightly smaller */
  font-weight: 500;
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.creatureSelect:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.creatureSelect:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
}

.sizeSlider {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--panel);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  touch-action: manipulation; /* Optimize touch interactions */
  -webkit-tap-highlight-color: transparent; /* Remove tap highlight on mobile */
}

.sizeSlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px; /* Larger for touch */
  height: 20px; /* Larger for touch */
  border-radius: 50%;
  background: var(--text);
  cursor: pointer;
  touch-action: manipulation;
}

.sizeSlider::-moz-range-thumb {
  width: 20px; /* Larger for touch */
  height: 20px; /* Larger for touch */
  border-radius: 50%;
  background: var(--text);
  cursor: pointer;
  border: none;
  touch-action: manipulation;
}

/* Mobile responsive - maintain exact layout, scale down */
@media (max-width: 768px) {
  .grid {
    gap: 0; /* Keep gap at 0 to maintain uniform background */
    padding: 0 12px;
  }
  .walletButton {
    padding: 6px 12px;
    font-size: 10px;
  }
  .infoRow {
    gap: 12px;
    flex-wrap: nowrap;
    justify-content: space-between;
  }
  
  .title {
    font-size: 18px;
    letter-spacing: 1.35px;
  }
  .specimenRow {
    gap: 12px;
    flex-wrap: nowrap; /* Keep layout structure */
    width: 90%; /* Take up 90% of viewport width */
    max-width: 900px; /* Cap at 900px when too wide */
    margin-bottom: 0; /* Ensure no gap on mobile */
  }
  
  .potSection {
    padding: 7.2px 5.4px;
    flex: 0 1 auto;
    min-width: 140px;
  }
  
  .potLabel {
    font-size: 9px;
  }
  
  .potValue {
    font-size: 16px;
  }
  
  .timerSection {
    padding: 7.2px 5.4px;
    flex: 0 1 auto;
    min-width: 140px;
  }
  
  .timerLabel {
    font-size: 8.1px;
  }
  
  .timerValue {
    font-size: 14px;
  }
  .specimenRow {
    max-width: 100%; /* Allow full width on mobile */
    gap: 8px;
    justify-content: center; /* Center the specimen */
  }
  .specimenRow > *:nth-child(1) {
    flex: 1 1 100%; /* Fill parent completely */
    width: 100%; /* Fill parent completely */
    max-width: 100%;
    min-width: 0;
    margin: 0; /* No margin - fill parent */
  }
  .specimenRow > *:nth-child(2) {
    display: none; /* Hide MovesTicker on mobile to save space */
  }
  .dialRow {
    gap: 2.5px; /* Further reduced to fit narrower width */
    flex-wrap: nowrap; /* Keep layout structure */
    overflow-x: hidden; /* Prevent horizontal scrolling */
    padding: 0 4.5px 4.5px 4.5px; /* Remove top padding to eliminate gap */
    width: 90%; /* Take up 90% of viewport width */
    max-width: 900px; /* Cap at 900px when too wide */
    box-sizing: border-box;
    margin-top: -1px; /* Slight overlap to eliminate any visible gap */
    box-shadow: 0 7px 21px rgba(0,0,0,.35); /* Match specimen shadow exactly */
  }
  .sliderRow {
    padding: 7.2px 12px;
    margin-top: 12px; /* Add margin to prevent overlap with buy button on mobile */
  }
  .sizeControl {
    min-width: 180px;
    max-width: 100%;
    width: 100%;
  }
  .sizeLabel {
    font-size: 10.8px;
  }
}

@media (max-width: 480px) {
  .grid {
    gap: 0; /* Keep gap at 0 to maintain uniform background */
    padding: 0 8px;
  }
  .walletButton {
    padding: 5px 10px;
    font-size: 9px;
  }
  .infoRow {
    gap: 8px;
    flex-wrap: nowrap;
    justify-content: space-between;
  }
  
  .title {
    font-size: 16.2px;
    letter-spacing: 0.9px;
  }
  .specimenRow {
    gap: 6px;
    flex-wrap: nowrap; /* Keep layout structure */
    width: 90%; /* Take up 90% of viewport width */
    max-width: 900px; /* Cap at 900px when too wide */
    justify-content: center; /* Center the specimen */
    margin-bottom: 0; /* Ensure no gap on mobile */
  }
  .specimenRow > *:nth-child(1) {
    flex: 1 1 100%; /* Fill parent completely */
    width: 100%; /* Fill parent completely */
    max-width: 100%;
    min-width: 0;
    margin: 0; /* No margin - fill parent */
  }
  .specimenRow > *:nth-child(2) {
    display: none; /* Hide MovesTicker on mobile to save space */
  }
  .dialRow {
    gap: 1.8px; /* Further reduced to fit narrower width */
    flex-wrap: nowrap; /* Keep layout structure */
    overflow-x: hidden; /* Prevent horizontal scrolling */
    padding: 0 3.6px 3.6px 3.6px; /* Remove top padding to eliminate gap */
    width: 90%; /* Take up 90% of viewport width */
    max-width: 900px; /* Cap at 900px when too wide */
    box-sizing: border-box;
    margin-top: -1px; /* Slight overlap to eliminate any visible gap */
    box-shadow: 0 6px 18px rgba(0,0,0,.35); /* Match specimen shadow exactly */
  }
  .potSection {
    padding: 4.5px 3.6px;
    flex: 0 1 auto;
    min-width: 80px;
  }
  .potLabel {
    font-size: 6.3px; /* Scale down */
  }
  .potValue {
    font-size: 12px; /* Scale down */
  }
  .timerSection {
    padding: 4.5px 3.6px;
    flex: 0 1 auto;
    min-width: 80px;
  }
  .timerLabel {
    font-size: 6.3px; /* Scale down */
  }
  .timerValue {
    font-size: 10.5px; /* Scale down */
  }
  .sliderRow {
    padding: 5.4px 8px;
    margin-top: 10px; /* Add margin to prevent overlap with buy button on smaller mobile */
  }
  .sizeControl {
    min-width: 160px;
    max-width: 100%;
    width: 100%;
  }
  .sizeLabel {
    font-size: 9.9px;
  }
}
```

---

## src/layout/AppLayout.module.css

```css
.shell{ min-height:100dvh; display:flex; flex-direction:column; }
.header{
  position:sticky; top:0; z-index:10;
  padding:8px 16px; background:#151823; box-shadow:var(--shadow);
  height: 60px;
  min-height: 60px;
}
.headerContent {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
}
.titleText {
  font-size: 21.6px;
  font-weight: 900;
  letter-spacing: 1.8px;
  color: var(--gold);
  text-transform: uppercase;
  margin: 0;
  text-align: left;
}
.headerRight {
  display: flex;
  align-items: center;
  gap: 12px;
}
.walletButton {
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 200, 100, 0.15));
  border: 1px solid rgba(0, 255, 136, 0.4);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 0 8px rgba(0, 255, 136, 0.2);
}
.walletButton:hover {
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.3), rgba(0, 200, 100, 0.25));
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.4);
  transform: translateY(-1px);
}
.title{ 
  font-weight:800; 
  letter-spacing:.3px; 
  margin: 0;
  text-align: center;
}
.main{ flex:1; max-width:1200px; margin:24px auto; padding:0 16px; width:100%; box-sizing: border-box; }

@media (max-width: 768px) {
  .titleText {
    font-size: 18px;
    letter-spacing: 1.5px;
  }
  .walletButton {
    padding: 4px 8px;
    font-size: 9px;
  }
  .headerRight {
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .titleText {
    font-size: 16px;
    letter-spacing: 1.2px;
  }
  .walletButton {
    padding: 3px 6px;
    font-size: 8px;
  }
  .headerRight {
    gap: 6px;
  }
}
```

---

## Summary

This snapshot includes:

1. **App Shell Files:**
   - `src/main.tsx` - Entry point with WagmiProvider and QueryClientProvider
   - `src/App.tsx` - Router provider wrapper
   - `src/routes.tsx` - Route definitions (experiment page at `/experiment`)

2. **Stabilization/Lab UI:**
   - `src/pages/ExperimentPage.tsx` - Main experiment page component
   - `src/layout/AppLayout.tsx` - Layout wrapper with header and wallet button

3. **Wagmi & Stabilization Config:**
   - `src/config/wagmiConfig.ts` - Wagmi configuration
   - `src/config/chains/apechain.ts` - ApeChain chain definition
   - `src/config/contracts/stabilizationV3.ts` - Contract addresses and ABIs

4. **Stabilization Hooks:**
   - `src/hooks/stabilizationV3/index.ts` - Hook exports
   - `useCreatureState.ts` - Read creature state
   - `useClaimDailyItems.ts` - Claim daily items
   - `useBurnItemForSP.ts` - Burn items for SP
   - `useLockTrait.ts` - Lock traits
   - `useApplyItem.ts` - Apply items
   - `useSendVibes.ts` - Send vibes
   - `useDailyItems.ts` - Preview daily items
   - `useInitializeCreature.ts` - Initialize creature
   - `useItemBalance.ts` - Check item balance
   - `useWalletSP.ts` - Check wallet SP

5. **Styling:**
   - `src/pages/ExperimentPage.module.css` - Experiment page styles
   - `src/layout/AppLayout.module.css` - Layout styles

**Key Integration Points:**
- The experiment page uses a grid layout with `specimenRow`, `dialRow`, and `sliderRow`
- Current creature selector is a simple `<select>` dropdown
- Wallet connection button exists in header but is not yet wired up
- All stabilization hooks are ready to use
- CSS uses CSS variables (`--gold`, `--text`, `--panel`, `--radius`, etc.) for theming

