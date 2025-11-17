# Developer Guide — Creature Stabilization System (v1)

This guide provides **engineering-facing documentation** for implementing the on-chain Stabilization, Resonance, and Evolution loop.  

It complements the stabilization-spec.md (rules) and stabilization-player-journeys.md (examples).

This document explains **how to build the system**, including:
- Smart contract architecture
- Storage model
- Pure functions & write ops
- Daily actions (Vibes + Drip)
- Item application logic
- Bonded vs wallet SP
- Locking logic
- Resonance timers
- Event schema
- Simulation notes

---

# 1. Contract Architecture

A minimal deployment consists of **one main contract** and optionally one **data library**.

### Core Contract: `CreatureStabilizer.sol`
Responsibilities:
- Store all per-creature state
- Expose write functions (apply item, burn item, send vibes, lock)
- Implement stabilization → resonance → incubation transitions
- Enforce all numeric rules
- Emit events for UI indexing

### Optional: `ItemGenerator.sol` (library)
- Pure functions for generating item rarities & deltas
- Deterministic pseudo-randomness based on blockhash + creatureId + dayIndex
- Mirror the exact distribution used in the simulation

### Optional: `Config.sol`
Put all tunable params here so they can be changed in future versions without touching logic.

---

# 2. Storage Layout

Each creature has:
```solidity
struct CreatureState {
    uint8 vibes;               // 0–10
    uint8 lockedCount;         // 0–4
    uint16 targetSal;          // 0–100
    uint16 targetPH;
    uint16 targetTemp;
    uint16 targetFreq;
    uint16 currSal;
    uint16 currPH;
    uint16 currTemp;
    uint16 currFreq;
    bool lockedSal;
    bool lockedPH;
    bool lockedTemp;
    bool lockedFreq;

    uint40 stabilizedAt;       // timestamp of full stabilization
    uint16 consecutiveVibeMax; // streak
    bool enhancedDrip;         // unlocked via streak
    uint16 bondedSP;           // SP usable only for this creature
}
```

Wallet-level data:
```solidity
mapping(address => uint32) walletSP; // total SP earned via burns
```

### Recommended:  

Pack traits together for gas savings; traits fit in `uint16` safely.

---

# 3. Constants (from v1 spec)

```solidity
uint8 constant LOCK_PCT = 5;              // 5% band
uint8 constant VIBES_MAX = 10;
uint8 constant VIBES_MIN = 0;
uint8 constant STREAK_DAYS = 7;
uint8 constant BONDED_SP_REWARD = 3;      // per streak
uint8 constant DAILY_DRIP_DEFAULT = 1;
uint8 constant DAILY_DRIP_ENHANCED = 2;
uint8 constant RESONANCE_DAYS = 7;

uint8 constant SP_COMMON = 1;
uint8 constant SP_UNCOMMON = 2;
uint8 constant SP_RARE = 3;
uint8 constant SP_EPIC = 5;               // from simulation
```

Lock costs:
```solidity
uint8[4] LOCK_COST = [0, 8, 10, 12];
```

---

# 4. Daily Actions

### 4.1 sendVibes(creatureId)
- Enforce 1-per-day via per-creature lastActionDay store
- If vibes < 10, increment
- If vibes == 10 and was at 10 yesterday → increment streak
- If streak hits 7:
  - `bondedSP += BONDED_SP_REWARD`
  - `enhancedDrip = true`

Decay occurs **implicitly**:  

If player doesn't call sendVibes today → vibes-- (clamped at 0).

Decay is applied when reading the lastActionDay vs today.

### 4.2 dailyDrip(creatureId)
Algorithm:
```
if lockedCount < 4:
    drip = enhancedDrip ? 2 : 1
else:
    drip = 0
```
Items must be generated deterministically.

---

# 5. Items (C/U/R/Epic)

Use pure functions to generate:
- Item rarity
- Primary trait target
- Primary delta
- Secondary target
- Secondary delta

### 5.1 Rarity Logic
Before Day 7:
```
Common 60%
Uncommon 25%
Rare 15%
Epic 0%
```
After Day 7:
```
Epic 2%
The remaining 98% follow 60/25/15 split.
```

### 5.2 Primary Delta
Match sim exactly:
```
Common:    +2 to +3
Uncommon:  +3 to +5
Rare:      +4 to +6
Epic:      handled separately
```

### 5.3 Secondary Interdependence
Scale factor = 15% to 30% of primary delta.
Same directional sign.

### 5.4 Epic Logic
When applying an Epic:
1. Find trait with **largest percent error**.
2. Move it **aggressively** toward the target (e.g., halve error).
3. All other **unlocked** traits get pushed ~10% further away.
4. Locked traits ignore secondary effects.

---

# 6. Applying Items On Chain

Pseudo-logic:
```solidity
function applyItem(uint256 id, Item memory item) external {
    CreatureState storage c = creatures[id];
    require(!isStabilized(c), "lockedAll");

    if (item.rarity == EPIC) {
        _applyEpic(c, item);
    } else {
        _applyLinear(c, item);
    }

    // After movement, check if any trait has entered lock band
    // but DO NOT auto-lock. Locking requires explicit call.
}
```

All movement operations **must clamp** to [0,100].
All secondary effects **must skip locked traits**.

---

# 7. Burning Items For SP

```solidity
function burnItem(uint256 id, Item memory item) external {
    if (item.rarity == COMMON) walletSP[msg.sender] += 1;
    if (item.rarity == UNCOMMON) walletSP[msg.sender] += 2;
    if (item.rarity == RARE) walletSP[msg.sender] += 3;
    if (item.rarity == EPIC) walletSP[msg.sender] += 5;
}
```

Burning items **never changes traits** and **never affects streak**.

---

# 8. Locking Traits

```solidity
function lockTrait(uint256 id, Trait t) external {
    CreatureState storage c = creatures[id];
    require(isLockable(c, t), "not_in_band");

    uint8 cost = LOCK_COST[c.lockedCount];
    uint16 bonded = c.bondedSP;
    uint32 wallet = walletSP[msg.sender];

    require(bonded + wallet >= cost, "insufficient_SP");

    // spend bonded first
    uint16 bondedSpend = cost > bonded ? bonded : cost;
    c.bondedSP -= bondedSpend;
    walletSP[msg.sender] -= (cost - bondedSpend);

    _markLock(c, t);
}
```

Lock semantics:
- Lock does not adjust traits.
- Locked traits ignore all future secondary effects.
- On 4 locks → set `stabilizedAt`.

---

# 9. Resonance Phase

After all 4 traits are locked:
```text
stabilizedAt = block.timestamp
```

To incubate:
```solidity
require(block.timestamp >= stabilizedAt + RESONANCE_DAYS * 1 days);
require(c.vibes == 10);
```

Incubation function can:
- burn the creature
- mint the evolved form
- or mutate in-place

---

# 10. Events

Emit events for:
- ItemApplied(id, rarity, primaryTrait)
- ItemBurned(id, rarity)
- TraitLocked(id, traitIndex, lockIndex)
- VibesUpdated(id, newValue)
- StreakCompleted(id)
- DripGranted(id, numItems)
- Stabilized(id)
- Evolved(id)

Frontends should index these.

---

# 11. Simulation Layer (Important for Dev Testing)

Sim scripts replicate exactly:
- Item rarity tables
- Primary/secondary deltas
- Epic behavior
- Vibes + decay
- Streak + bonded SP
- Hybrid drip logic
- Lock costs
- SP spending order (bonded -> wallet)

Two simulation modes exist:
- **sim_single.py** – Monte Carlo for a single creature (1,000 runs)
- **sim_multi.py** – Multi-wallet simulation using real holder CSV

All balancing in the spec was derived from the **player-like** versions:
- 1–2 items/day (Vibes-dependent)
- Epic unlock after Day 7
- Average stabilization 12–16 days
- ~8–10 items per creature

---

# 12. Deployment Checklist

### Before launch
- [ ] Config constants verified
- [ ] Rarity tables match simulation
- [ ] Epic logic wired to a pure library
- [ ] Traits clamped correctly
- [ ] Vibes decay tested
- [ ] Lock band percent correct
- [ ] Resonance timer correct
- [ ] All events firing
- [ ] No auto-locking (must always be explicit)
- [ ] No item generation on Day 0 after starter pack
- [ ] Drip disabled after stabilization

### Post-launch tuning (safe to change)
- Primary deltas
- Secondary scaling
- Epic rarity
- SP yields
- Lock costs of 2nd/3rd/4th lock
- Resonance duration

---

# 13. Summary For Engineers

The system is:
- **Purely deterministic**
- **Fully on-chain** (no server drift)
- Based on **integer math only**
- With a clean separation between:
  - Trait movement
  - Burn-for-SP
  - Lock operations
  - Vibes + streak + drip
  - Resonance timers

All behavior has been validated through the **player-like simulation engine**.

If you build exactly what is here, the game will behave exactly as designed and as simulated.

