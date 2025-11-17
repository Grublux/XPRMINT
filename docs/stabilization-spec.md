# Creature Stabilization & Resonance System — v1 Spec

**Version:** v1 (Hybrid Drip + Epics + Min Offset)
**Scope:** Mechanics + tuning for on-chain stabilization, resonance, and incubation.
**Audience:** Smart contract devs, gameplay devs, and design partners.

---

## 0. High-Level Loop

Each creature goes through:

1. **Unstable Phase**  
   - Four lab traits are off-target.  
   - Player uses items to adjust traits & locks them one by one.  
   - Daily item drip + streak bonuses fuel progress.

2. **Stabilized Phase**  
   - All four traits are **locked** within a 5% band of their targets.  
   - Creature is now "Stable" (ready to begin Resonance).

3. **Resonance Phase**  
   - 7-day timer where the creature remains fully locked.  
   - Player must continue to send Vibes (0–10 scale).  
   - At the **end of 7 days**, Vibes must be **10** to incubate.

4. **Incubation → Evolution**  
   - Once Resonance conditions are met, player can call `incubate()` / `evolve()` on-chain.  
   - Stabilization + resonance state is consumed → new evolved form minted / existing metadata updated (implementation-dependent).

All core state is **on-chain**: no server-driven drift, no off-chain timers.

---

## 1. Traits & Targets

### 1.1 Trait List

Each creature has 4 continuous traits:

1. **Salinity**
2. **pH**
3. **Temperature**
4. **Frequency**

Each trait has:
- `target[t]` — target value (visible to player)
- `current[t]` — current value (visible)
- `locked[t]` — boolean lock flag

Targets are **per-creature**, fixed once initialized.

### 1.2 Trait Ranges (Conceptual)
Traits are numeric scalars with a fixed ±5% stabilization window.

Contracts only care about:
- Absolute values
- % distance from target
- Lock-state

### 1.3 Lock Band
A trait is lock-eligible when:

```
abs(current[t] - target[t]) / abs(target[t]) <= 0.05
```

### 1.4 Initial Trait Offsets

We enforce **no trait starts inside the lock window**.

- `OFFSET_MAX_PCT = 0.30` (30%)
- `LOCK_PCT = 0.05` (5%)

Initialization:
1. Pick target `target[t]` (reasonable mid-range).
2. Draw `f` ∈ [-0.30, +0.30].
3. If `|f| < 0.05`, clamp to ±0.05.
4. Set `current[t] = target[t] * (1 + f)`.

---

## 2. Items, Rarity, & Interdependence

Each item:
- Has a rarity (Common/Uncommon/Rare/Epic)
- Moves traits when **applied**
- Generates SP when **burned**

### 2.1 Rarity Base Distribution

Before Epics unlock (Day < 7):
- Common 60%
- Uncommon 25%
- Rare 15%

After Epic unlock (Day ≥ 7):
- Epic ~2%
- Remaining 98% distributed as C/U/R

### 2.2 Primary Deltas (Non-Epic)
```
common:   +2 to +3
uncommon: +3 to +5
rare:     +4 to +6
```

Movement **always toward the target**.

### 2.3 Secondary Interdependence
For non-Epic items:
```
secondary = primary_delta * s
s ∈ [0.15, 0.30]
```
Applies to another trait and moves it **away** from target (unless locked).

### 2.4 Epics (Puzzle-Shapers)
Epic item behavior:
1. Find worst trait (largest % error).
2. Pull it significantly closer:
   - If >10% away (2×LOCK_PCT): snap to exactly 10% error.
   - Else: halve its error.
3. For all other **unlocked** traits:
   - Increase error by 10% (push further away).
4. Locked traits ignore secondary chaos.

### 2.5 SP From Burning Items
- Common → 1 SP
- Uncommon → 2 SP
- Rare → 3 SP
- Epic → 3 SP

SP only comes from **burning**, not applying.

SP is:
- Stored per wallet
- Non-transferable
- Only spent to lock traits

---

## 3. Daily Drip & Starter Pack

### 3.1 Starter Pack
Each creature receives **5 items** at first interaction.
No Epics in starter pack.

### 3.2 Hybrid Drip System
Baseline:
- **1 item/day** per **unstabilized** creature

If the creature hits a 7-day Vibes-at-max streak:
- Drip becomes **2 items/day**
- Reverts to 1/day if streak breaks

### 3.3 Epic Unlock Timing
- Days 0–6: C/U/R only
- Day 7+: Epic ~2% chance

---

## 4. Vibes System

### 4.1 Scale
- Integer 0–10

### 4.2 Sending Vibes
`sendVibes(creature)`:
- Raises Vibes up to max 10
- Used to maintain drip streaks

### 4.3 Vibes Streaks
Track:
- `consecutiveDaysAtMax`

Seven consecutive days at Vibes=10:
- Enables 2-item daily drip
- Lose streak → revert to 1/day

### 4.4 Vibes Requirement for Incubation
During Resonance:
- No streak needed
- On day of incubation: **Vibes must be 10**

---

## 5. Lifecycle States

```
UNSTABLE → STABLE → RESONANCE → EVOLVED
```

### 5.1 Stabilization (Unstable → Stable)
Conditions:
- Move traits with items
- Burn items to get SP
- Lock traits once within ±5%

Lock costs:
- 1st lock: 0 SP
- 2nd lock: 8 SP
- 3rd lock: 10 SP
- 4th lock: 12 SP

All traits locked → creature becomes **Stable**.

### 5.2 Resonance (Stable → Resonance)
Resonance begins as soon as all 4 traits locked.

Duration:
- 7 days

### 5.3 Incubation (Resonance → Evolved)
At incubation call:
- Has been in resonance ≥ 7 days
- **Vibes == 10**
- Not already evolved

---

## 6. SP Economy

### 6.1 SP Generation
SP from burning items only.

### 6.2 SP Spending
Used to lock traits (0/8/10/12 values).

### 6.3 Strategy
Players choose:
- When to burn vs apply
- Which traits to prioritize
- How to manage Epics

---

## 7. Simulation Summary (v1 Final)

Sim conditions:
- Hybrid drip
- Epics 2% from Day 7
- Min offset 5% (no free locks)
- Interdependence 15–30%
- 2,661 real creatures from holder distribution

### 7.1 Single Simulation (1,000 trials)
- Stabilization: **100%**
- Avg days: **~15.94**
- Median: **15**
- Avg items used: **~9.64**

### 7.2 Multi Simulation (2,661 creatures)
- Stabilization rate: **99.92%–100%** (depending on run seed)
- Mean days: **~13.3**
- Median: **11**
- Items per creature: **~7.7**
- No whales got stuck
- No creature needed >30 items

---

## 8. Contract Implementation Notes

### 8.1 Creature State
```
struct CreatureState {
  uint256[4] target;
  uint256[4] current;
  bool[4] locked;
  uint8 vibes;
  uint64 stabilizedAt;
  uint64 resonanceStart;
  bool evolved;
  uint8 consecutiveVibesAtMax;
  bool dripUpgraded;
}
```

### 8.2 Wallet SP
- `mapping(address => uint256) walletSP`;

### 8.3 Core Methods
- `applyItem()`
- `burnItemForSP()`
- `lockTrait()`
- `sendVibes()`
- `incubate()` / `evolve()`

---

## 9. Future Extensions
- Additional Epic types
- Temporary global modifiers
- Social/linked stabilization mechanics
- Additional drip or SP sinks/sources

---

## 10. Summary
v1 delivers:
- Fully on-chain stabilization
- Hybrid drip economy
- Vibes-driven engagement
- Burn-based locking via SP
- Epics as meaningful puzzle shapers
- Proven tuning via Monte Carlo simulation

This spec is ready for contract + frontend implementation.
