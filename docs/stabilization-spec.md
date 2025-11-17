# Creature Stabilization & Resonance System — v1 Spec

**Scope:**  
On-chain system for stabilizing lab creatures by tuning four traits with consumable items, locking traits, and driving toward evolution. This spec describes the core mechanics and the parameters validated by simulations.

---

## 1. High-Level Loop

Each creature passes through four phases:

### 1. Unstable
- Four traits begin offset from their targets.
- Creature generates items daily.
- Player uses items to modify traits.
- Player can burn items for Stability Points (SP).
- Player locks traits once they're in-range.

### 2. Stabilized
- All 4 traits locked (within ±5% of target at time of locking).
- No drift. No more item drip.
- Creature becomes eligible for Resonance.

### 3. Resonance Phase
- Resonance period is 7 days in duration.
- No drift. No trait changes.

### 4. Evolution
- After Resonance (7 days elapsed) AND Vibes == 10, evolve/incubate becomes available.
- Evolution logic is out of scope for this document.

---

## 2. Traits Model

Creatures have 4 traits:

- `salinity`
- `ph`
- `temperature`
- `frequency`

Stored normalized (0–100).  
Front-end maps to real-world analogs (Hz, °C, pH units, etc).

Each trait stores:

- `target[t]`
- `current[t]`
- `locked[t]`

---

## 2.1 Target Visibility

Targets are ALWAYS visible.  
Players see both `current` and `target`.

---

## 2.2 Initial Trait Offsets

No trait may begin within the lock band.

Constants:

- `LOCK_PCT = 0.05`  (±5%)
- `OFFSET_MAX_PCT = 0.30` (±30%)

Initialization:

1. Pick `target[t]` (typically 20–80).
2. Choose offset factor `f ∈ uniform(-0.30, +0.30)`.
3. If `|f| < 0.05`, clamp to `±0.05`.
4. Compute:

```
current[t] = target[t] * (1 + f)
```

All traits begin 5–30% off-target.

---

## 2.3 Lock Band

Trait is lockable if:

```
abs(current - target) ≤ target * LOCK_PCT
```

---

## 3. Items & Interdependence

Items have:

- A **primary** effect (large movement)
- A **secondary** effect (small interdependent movement)
- Optional burn-for-SP behavior

### 3.1 Rarity & Drop Rates

- **Common** — 60%
- **Uncommon** — 25%
- **Rare** — 15%

### 3.2 Primary Delta Strength (v1 Final)

- Common:   **+2 to +3**
- Uncommon: **+3 to +5**
- Rare:     **+4 to +6**

Direction always moves toward target for the primary trait.

### 3.3 Secondary Interdependence

Secondary delta:

```
secondary = primary * s
s ∈ uniform(0.15, 0.30)
```

- Applied to a second trait.
- Locked traits ignore secondary effects.

### 3.4 SP From Burning Items

- Common:   **1 SP**
- Uncommon: **2 SP**
- Rare:     **3 SP**

Burning an item changes no traits.

### 3.5 Epic Items (Reserved for Future Phases)

> **Important:** Epic items are **not** part of the v1 stabilization balance.  
> They are reserved for future content and are intentionally excluded from all v1 simulations.

In v1, the live economy only uses three rarities:

- Common
- Uncommon
- Rare

Epic items are reserved for later expansions and will be designed to:

- **Modify constraints**, not just push bigger numbers  
- Introduce **tactical tradeoffs** (e.g., helping one trait while hurting others)  
- Avoid trivializing stabilization or bypassing SP costs  
- Live **outside** the baseline daily drip (e.g., events, crafting, special drops)

Conceptual examples (non-final):

- **Harmonic Pulse Vial**  
  - Bring one chosen trait into a "near band" (e.g., within ±10% of the lock band)  
  - Push all other *unlocked* traits a fixed % further away from their targets  
  - Does not grant a free lock, but reshapes the puzzle with a cost.

- **Interphase Dampener**  
  - Temporarily disables secondary (interdependent) effects for a small number of moves  
  - Allows precise adjustments without long-term changes to math or SP.

Implementation constraints for future Epics:

- They must **not**:
  - Auto-lock traits for free  
  - Fully align multiple traits at once  
  - Mass-generate SP beyond the tuned economy  
- They should:
  - Operate as **special-case effects** layered on top of the existing item engine  
  - Be gated by separate minting logic (events, crafting, etc.), not by the standard drip

For v1:

- No Epics are emitted via:
  - Awakening packs  
  - Daily drip  
  - Streak rewards  
- All simulation results and tuning assume **Epic = disabled**.

---

## 4. Stability Points (SP) & Locks

Two SP pools:

### 4.1 Wallet SP
- Comes from burning items.
- Shared across wallet.
- Not transferable.

### 4.2 Bonded SP
- Awarded by Vibes streaks.
- Only usable on that creature.

### 4.3 Lock Costs

Per-creature lock sequence:

```
1st lock — 0 SP (free)
2nd lock — 8 SP
3rd lock — 10 SP
4th lock — 12 SP
```

### SP Spend Order

```
1. consume bonded SP
2. consume wallet SP
```

### Lock Preconditions

To lock:

- Trait in band (±5%)
- Not already locked
- Enough SP available
- Lock slot available

---

## 5. Vibes (0–10)

Tracks daily player interaction.

### 5.1 Stored State

- `vibes ∈ [0,10]`
- `lastVibesTimestamp`
- `consecutiveDaysAtMax`
- `hasCompletedStreak`
- `currentStreakActive`

### 5.2 Daily Decay

```
vibes -= full_days_elapsed
vibes = max(0, vibes)
```

### 5.3 sendVibes()

```
vibes = min(10, vibes + 1)
```

Streak logic:

- If vibes == 10 → `consecutiveDaysAtMax++`
- Else → streak resets

### 5.4 Streak Reward

When a creature hits **7 consecutive days at max Vibes**:

- Award **3 bonded SP**
- Upgrade drip from 1 item/day → **2 items/day**
- Streak stays active as long as vibes remain 10

If vibes drop below 10:

- Streak ends  
- Drip returns to **1/day**

---

## 6. Item Drip (Hybrid System)

Per creature:

- Base drip: **1 item/day**
- If hasCompletedStreak AND currentStreakActive:  
  → **2 items/day**
- After stabilization (4 locks):  
  → Drip permanently stops

---

## 7. Player Actions (On-Chain)

### 7.1 claimDailyItems(creatureId)
- Calculates days since last claim
- Mints 1 or 2 items/day
- Applies rarity distribution

### 7.2 sendVibes(creatureId)
- Applies decay
- Increments vibes
- Handles streak logic
- May award bonded SP and drip upgrades

### 7.3 applyItem(creatureId, itemId, primaryTrait)
- Applies primary + secondary deltas
- Secondary ignored if trait locked
- Item burned
- Reverts if creature fully stabilized

### 7.4 burnItemForSP(itemId)
- Burns item  
- Adds SP to the wallet

### 7.5 lockTrait(creatureId, trait)
- Requires trait in lock band  
- Burns bonded SP first, then wallet SP  
- Locks the trait  
- On fourth lock → stabilization event

---

## 8. Resonance Phase (Post-Stabilization)

Once stabilized:

- No more drip  
- No trait drift  
- Resonance period begins (7 days duration)
- To enable incubation after 7 days:
  - Has been in resonance for ≥ 7 days? **Y**
  - Has a Vibes reading of 10? **Y**
  - → `canEvolve(creatureId) = true`

Evolution contract checks this flag. No streak required—just 7 days elapsed and Vibes = 10.

---

## 9. Simulation Summary (v1 Final Config)

### 9.1 Single Creature Monte Carlo (1000 runs)
- Stabilization rate: **100%**
- Avg days: **~16.2**
- Avg items used: **~10**
- No extreme tails

### 9.2 Multi-Wallet Simulation (2,661 creatures)
- Stabilization rate: **100%**
- Mean days: **~13.8**
- Median days: **12**
- Avg items used: **~8.6**
- All whale wallets successfully stabilized  
- Item economy stays balanced

---

## 10. Example Player Journey

### Single Creature (Condensed)

- Day 0:  
  - One trait autolocks  
  - A few items burned for early SP  
  - Vibes streak started  
  
- Day 2:  
  - pH locked (8 SP)  
  - Drip still 1/day  
  
- Day 7:  
  - Streak completes → +3 bonded SP & drip 2/day  
  
- Day 13–16:  
  - Remaining traits locked  
  - Stabilized  
  
Total: ~5 applied, ~11 burned, ~16 days.

---

## 11. Implementation Notes

- "Daily" logic uses timestamps  
- No cron jobs  
- Locked traits immutable  
- SP arithmetic must be exact  
- Trait values clamped to 0–100  
- Lock costs deterministic  

---

# END OF SPEC

