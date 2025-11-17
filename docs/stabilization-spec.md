# Creature Stabilization & Resonance System — v1 Spec

_Last tuned with the **player-like** simulations (multi-wallet + single-wallet) using real holder distribution and Epic items unlocked after Day 7._

---

## 0. Purpose & Scope

This document defines the **on-chain game loop** for stabilizing lab creatures so they can evolve.

Core loop:

1. **Unstable → Stable** via items that adjust four traits.
2. **Resonance Phase**: remain fully locked for 7 days.
3. **Vibes check** (must be max) → **Incubate** → **Evolve**.

Everything here is designed to be:

- **Fully on-chain** (no server-side drift).
- **Deterministic & replayable** from contract state.
- **Tunable** via a small set of config constants.

This spec matches the behavior used in the latest player-like simulations:

- Single-creature Monte Carlo (1,000 runs).
- Multi-wallet Monte Carlo using real holder distribution (2,661 creatures).
- Hybrid drip (1 item/day → 2 items/day with a Vibes streak).
- Epic items unlocked from **Day 7** onward.

---

## 1. Traits & Lock Rules

Each creature has 4 independent traits:

- **Salinity**
- **pH**
- **Temperature**
- **Frequency**

### 1.1 Value Ranges

On chain, we treat all traits as integer values on the same numeric scale, even if the UI presents them differently:

- `TRAIT_MIN = 0`
- `TRAIT_MAX = 100`

Each trait `t` has:

- `target[t]` — the **visible** target value for the player (stored on-chain).
- `current[t]` — the current measured value (stored on-chain).
- `locked[t]` — boolean.

**Targets are always visible.** There is no hidden target: players are optimizing against known numbers.

### 1.2 Lock Band (±5%)

We define a **lock band** in **percentage distance** from the target:

- `LOCK_PCT = 0.05` (5%)

A trait is **lockable** when:

```text
distance_pct(t) = abs(current[t] - target[t]) / target[t] <= LOCK_PCT
```

Constraints:

- Lockable **only if** `locked[t] == false`.
- Once `locked[t] == true`, it **never unlocks**.
- Secondary (interdependent) effects **ignore locked traits**.

A creature is **stabilized** when **all 4 traits are locked**, each within the 5% band at the moment of lock.

---

## 2. Trait Initialization

### 2.1 Target Generation

Per trait `t`:

```text
target[t] ∈ [TARGET_MIN, TARGET_MAX]
TARGET_MIN = 20
TARGET_MAX = 80
```

Exact range is tunable but mid-band values (20–80) were used in simulations.

### 2.2 Initial Offsets (Never Start Inside the Lock Band)

We **never** allow a trait to start already within the lock band.

Constants:

- `LOCK_PCT = 0.05` (5%).
- `OFFSET_MAX_PCT = 0.30` (30%).

For each trait:

1. Draw `target[t]`.
2. Draw offset factor `f ∈ uniform(-OFFSET_MAX_PCT, OFFSET_MAX_PCT)`.
3. If `abs(f) < LOCK_PCT`, clamp it to exactly `LOCK_PCT` with the same sign.
4. Compute:

   ```text
   raw = target[t] * (1 + f)
   current[t] = clamp(round(raw), TRAIT_MIN, TRAIT_MAX)
   ```

Result:

- Initial distance is **between 5% and 30%** away from target for each trait.
- No free locks at time 0.

---

## 3. Items & Interdependence

Items are the **only way** to move traits during the Stabilization Phase. Each item has:

- A **rarity**.
- A **primary trait** it targets.
- A **primary delta** (how much it moves that trait).
- A **secondary effect** on another trait (interdependence).
- An **SP yield** if burned instead of applied.

### 3.1 Rarity & Timing

Base rarities:

- **Common** — 60%
- **Uncommon** — 25%
- **Rare** — 15%
- **Epic** — 0% before Day 7, then 2% after Day 7

More precisely in the sim:

- **Starter Pack (Day 0)** and **Days 1–6 drip**: only Common/Uncommon/Rare with 60/25/15 split.
- **From Day 7 onward**:
  - 2% of drops are **Epic**.
  - Remaining 98% follow the 60/25/15 C/U/R distribution.

This keeps early play simple, then introduces Epics as a late-game puzzle spice.

### 3.2 Primary Deltas (v1 Final)

All primary deltas are **integer steps** directly toward the target.

- **Common**: `+2` to `+3` (toward target)
- **Uncommon**: `+3` to `+5`
- **Rare**: `+4` to `+6`

Rules:

- The sign is chosen so the primary trait **always moves toward its target**.
- Clamped to `[TRAIT_MIN, TRAIT_MAX]`.

### 3.3 Secondary Interdependence (C/U/R)

Every non-Epic item also has a smaller **secondary effect** on a different trait.

For an item with primary delta `primary_delta` on trait `A`:

1. Secondary trait `B = INTERDEPENDENCE[A]` (fixed mapping, e.g. a 4-cycle).
2. Sample `scale ∈ uniform(0.15, 0.30)`.
3. Compute:

   ```text
   secondary_magnitude = max(1, round(abs(primary_delta) * scale))
   secondary_delta = sign(primary_delta) * secondary_magnitude
   ```

4. Apply to `B` **only if** `locked[B] == false`.

This creates **soft coupling** between traits without making the system chaotic.

### 3.4 Epic Items — Puzzle Shapers

Epics are **not** just bigger numbers. They are **puzzle shapers**.

Epic behavior in v1 sim:

- Determine the trait `W` with the **largest percentage error**.
- Move `W` **aggressively toward** its target, e.g. by halving the percent error or snapping it close to the inner band.
- At the same time, **push other unlocked traits** slightly **away** from their targets (e.g. ~10% worse) to keep tension.

Principles:

- Epics should feel like **big swings** and **interesting decisions**, not automatic wins.
- They can be burned for a **larger SP yield** than Rare (e.g. 5 SP).

Exact Epic parameters are configurable in the contracts, but the behavior and timing (unlock from Day 7) should match this spec.

### 3.5 SP From Burning Items

Any item can be **burned for SP** instead of being applied.

Baseline SP yields:

- Common → **1 SP**
- Uncommon → **2 SP**
- Rare → **3 SP**
- Epic → **5 SP** (tunable; must be strictly > Rare)

**Burning an item never changes traits.** It only increases wallet SP (or creature-bound SP in some cases).


---

## 4. Stability Points (SP) & Locks

SP is the currency used to **pay for locks**.

### 4.1 Sources of SP

Two sources:

1. **Wallet SP** — from burning items:
   - Burn any item → gain SP according to rarity.
   - Wallet SP is **shared across all creatures** in that wallet.

2. **Bonded SP** — from Vibes streaks (see §5):
   - Bonded SP is **bound to a single creature** and can only pay for that creature's locks.

### 4.2 Lock Costs

Lock costs by lock index (0-based) per creature:

- 1st lock: **0 SP** (free lock)
- 2nd lock: **8 SP**
- 3rd lock: **10 SP**
- 4th lock: **12 SP**

SP can be paid from:

- Bonded SP for that creature.
- Wallet SP.
- Or a combination thereof.

Locking rule:

- Trait must be **lockable** (≤ 5% distance) at the time of lock.
- Once locked, that trait never changes again.

### 4.3 Player-Like Lock Strategy (as used in sims)

The player-like agent used in simulations behaves roughly as an optimizer would:

- **Never burns items for SP** unless:
  - There is at least one trait for some creature in the wallet that is **currently lockable**, and
  - The wallet plus bonded SP is **insufficient** to pay the next lock cost.
- Burns the **lowest-yield** items first to reach the needed SP.
- Always uses available SP to lock traits as soon as a lockable trait exists.

This is the behavior we assume real players will approximate.

---

## 5. Vibes & Resonance

Vibes are a simple **engagement meter** with hard bounds:

- `VIBES_MIN = 0`
- `VIBES_MAX = 10`

### 5.1 Sending Vibes

We expose a `sendVibes(creatureId)` function:

- Can be called **once per day per creature**.
- On call:
  - Increment Vibes by +1 up to `VIBES_MAX`.
  - Update streak tracking.
- If the player **does not** call `sendVibes` on a given day, Vibes **decays** by 1 (down to 0).

Interpretation:

- Daily "pet your creature" or "say hello" action.
- Frontend can display this however we like — the contract only needs to store the integer.

### 5.2 Vibes Streak → Bonded SP + Drip Upgrade

We track a **max Vibes streak** per creature:

- Each day the creature is at `VIBES_MAX` **and** `sendVibes` is called, we increment `consecutive_vibes_at_max`.
- Hitting a streak of **7 consecutive days** at max Vibes:
  - Grants **+3 bonded SP** to that creature.
  - Unlocks **enhanced drip**: 2 items/day instead of 1.

If Vibes ever drop below max:

- Streak counter resets.
- Enhanced drip deactivates until another 7-day max-Vibes streak is achieved.

This means engaged players effectively accelerate their item flow.

### 5.3 Resonance Phase (Post-Stabilization)

Once a creature is fully stabilized:

1. We record `stabilizedAt` (block timestamp or day index).
2. The creature enters the **Resonance Phase**.

Resonance rules:

- Duration: **7 days** (configurable as `RESONANCE_DAYS = 7`).
- During Resonance the player **can** keep sending Vibes, but a streak is **not required**.
- To incubate, two conditions must be true:

  1. `now - stabilizedAt >= RESONANCE_DAYS`.
  2. `vibes == VIBES_MAX` (10) **at the time of incubation call**.

So post-stabilization the player must:

- Wait 7 days.
- Ensure the creature is at Vibes 10 on the day they trigger incubation.

No additional streak is required; only the hard **Vibes == 10** check.

---

## 6. Lifecycle Phases

### 6.1 Phase 0 — Awakening

When the system goes live or when a creature is first "woken up" into this system:

- Each creature receives a **Starter Pack** of **5 items** immediately.
- Starter Pack contains only **Common/Uncommon/Rare** items (no Epics).
- Vibes start at **9** (so the first `sendVibes` can hit 10 quickly).
- `stabilized = false`, `locked[t] = false` for all traits.
- `walletSP = 0`, `bondedSP = 0` for all creatures.

There is **no drip on Day 0** — drip starts on Day 1.

Players can begin applying or burning items on Day 0.

### 6.2 Phase 1 — Daily Drip

Each day, for each **unstabilized** creature:

- The creature receives:
  - **1 item/day** by default.
  - **2 items/day** if the creature has an active max-Vibes streak (see §5.2).

Drip stops permanently for that creature once it is fully stabilized (all 4 traits locked).

### 6.3 Phase 2 — Stabilization

While `stabilized == false` the player can:

- Apply items (moving traits via primary + secondary effects).
- Burn items for SP.
- Spend SP to lock traits once they are in the 5% band.
- Send Vibes to:
  - Maintain or grow streaks.
  - Unlock bonded SP.
  - Upgrade drip to 2 items/day.

Once **all 4 traits** are locked, the creature is considered **stabilized** and moves to Resonance.

### 6.4 Phase 3 — Resonance

- Start: `stabilizedAt` = current timestamp/day index.
- Duration: `RESONANCE_DAYS = 7`.
- Player should:
  - Keep the creature's Vibes healthy.
  - Ensure it is at Vibes 10 when ready to incubate.

No additional trait movement is possible (all traits are locked).

### 6.5 Phase 4 — Incubation & Evolution

When:

1. `now - stabilizedAt >= RESONANCE_DAYS`, and
2. `vibes == VIBES_MAX` (10), and
3. `stabilized == true`,

…then the player can call `incubate(creatureId)`.

Expected on chain behavior:

- Mark the creature as **evolved**.
- Burn or morph the stabilizing token into an evolved form.
- Optionally emit events to allow frontend to show a reveal.

---

## 7. Calibration Snapshot (Player-Like Sims)

These numbers are **from the latest player-like simulations**, not from a naive or over-strict bot. The agent:

- Uses up to ~30 actions/day.
- Uses items and burns for SP **only when helpful**.
- Locks traits as soon as they are in range and SP is available.

All simulations use:

- 4 traits per creature.
- Initial offsets between 5% and 30% from target.
- Primary deltas: Common 2–3, Uncommon 3–5, Rare 4–6.
- Secondary interdependence: 15–30% of primary delta, same direction.
- Hybrid drip: 1 item/day → 2 items/day with a 7-day max-Vibes streak.
- Epics: 2% of drops from Day 7 onwards, puzzle-shaping behavior.

### 7.1 Single-Creature Monte Carlo (1,000 runs)

- Stabilization rate: **100%**
- Average days to stabilization: **~15.1 days**
- Median days: **14**
- Average items used per creature: **~9.4 items**

Interpretation:

- A solo holder who actually plays reasonably will **always** stabilize within the 60-day window.
- The time and item count feel like a **medium-difficulty puzzle**, not a trivial tap.

### 7.2 Multi-Wallet Simulation (Real Holders, 2,661 Creatures)

Using the real distribution of holders (whales, mid-holders, and many 1-unit wallets):

- Total creatures: **2,661**
- Stabilized: **2,661**
- Unstabilized after 60 days: **0**
- Stabilization rate: **100%**
- Mean days to stabilization: **~12.9 days**
- Median days: **12 days**
- Min/Max days: **0 / 56 days**
- Average items per stabilized creature: **~7.73 items**
- Whale wallets (> 10 creatures): **62**
- Whale failures: **0**

Notes:

- Multi-creature wallets stabilize **faster on average** than solos because they can pool SP and items intelligently.
- Average items per stabilized creature stays in the **7–10 item** band we were targeting.

### 7.3 Tuning Levers (Post-Launch)

If real gameplay data suggests difficulty is too high/low, the primary levers are:

1. **Primary deltas** — shrink or enlarge deltas to make traits converge slower/faster.
2. **Secondary interdependence** — increase/decrease to make the puzzle more/less coupled.
3. **Drip rate** — adjust baseline or streak multipliers.
4. **Streak rewards** — adjust bonded SP per streak.
5. **Epic rate and behavior** — adjust unlock day, drop chance, or how aggressively Epics reshape the puzzle.

These can be implemented as config values or upgradable via a governance/admin contract, without changing core game loop semantics.
