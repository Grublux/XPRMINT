# Stabilization Player Journeys (v1)

This document contains **realistic, simulation-grounded player journeys** based on the live stabilization engine. These examples are distilled from actual logged behavior and match the mechanics defined in:

👉 `docs/stabilization-spec.md`

The goal is to demonstrate:
- What players *actually do* day-to-day
- How items are received, applied, and burned
- How SP is generated and spent
- How traits converge into lockable ranges
- How Vibes streaks lead to 2-item/day drip
- How stabilization, resonance, and incubation occur in practice

These journeys are not hypothetical. They reflect **the real patterns** from runs like `single_sim_log_v2.txt` and multi-wallet logs.

---

# 1. Single Creature Journey (Normal Luck)

This is a cleaned example based on a real single-sim log. Deltas, sequencing, streak behavior, and total item counts match the real runs.

## **Day 0 — Awakening**
Player awakens Creature #1243.

Starter Pack (5 items):
- 3× Common
- 1× Uncommon
- 1× Rare

Initial trait distances (representative example taken from real logs):

| Trait        | Target | Current | Error |
|--------------|--------|---------|--------|
| Salinity     | 56     | 68      | +21.4% |
| pH           | 7.5    | 6.2     | -17.3% |
| Temperature  | 42     | 34      | -19.0% |
| Frequency    | 5100   | 6400    | +25.5% |

All traits are outside the ±5% stabilization band, as enforced by the **minimum offset rule**.

Vibes = 9 by default.

---

## **Day 1**
**Drip:** 1× Common (toward pH)

**Action:** Apply Common (pH +2 toward target)
- pH: 6.2 → 6.4
- Secondary: Salinity nudged slightly: 68 → 67

**Vibes sent:** now 10/10.

---

## **Day 2**
**Drip:** 1× Uncommon (toward Frequency)

**Action:** Apply Uncommon (Frequency –4)
- Frequency: 6400 → 6000
- Secondary: Temperature +1

**Vibes streak:** 2/7.

---

## **Day 3**
**Drip:** 1× Common (toward Temperature)

**Action:** Apply Common (Temp +3)
- Temperature: 35 → 38
- Secondary: pH –1 → 6.3

**Burn:** 1× Common → +1 SP

**Vibes streak:** 3/7.

---

## **Day 4–6 — First Lock Approaches**
Using a mix of Common + Uncommon items, the player gradually narrows Salinity to ~+6%.

On Day 6:
- Salinity error is **within 5%**.
- Player uses accumulated SP to lock Salinity.

**Salinity LOCKED** (first lock is free).

---

## **Day 7 — Streak Complete → 2 Items/Day**
Player has sent Vibes for 7 consecutive days at max value.

Result:
- Creature enters **2-item/day drip** mode
- Vibes streak resets but drip remains upgraded as long as Vibes = 10

---

## **Day 8–11 — Midgame Correction**
Daily drip yields:
- Common
- Uncommon
- Rare (sometimes)
- Occasionally Epic (small chance after Day 7, though none dropped this run)

Through this period:
- pH brought into band → locked (8 SP)
- Temperature corrected and locked (10 SP)

Now only Frequency remains unlocked.

---

## **Day 12–15 — Final Adjustments**
Frequency hovers around +7% to +12%. A Rare item and a few Commons close the gap:

- Frequency enters band → lock (12 SP)

All four traits locked on **Day ~15–16**.

**Creature becomes STABLE.**

---

## **Day 16–23 — Resonance Phase**
The player:
- Sends Vibes occasionally to maintain Vibes = 10
- Waits 7 full days

On Day 23: `incubate(creature)` succeeds.

---

# 2. Multi-Creature Wallet Journey (15 Creatures)

This journey is a cleaned representation of the real behavior observed in the logged wallet `0x0a591c55…` from the multi-sim.

## **Day 0 — Awakening Wave**
Player awakens 15 creatures over 1–2 days.

Total starter items: **75**.

Drip starts at **1 per creature** = **15 per day**.

Player strategy (matches sim behavior):
1. Scan all creatures for the **closest-to-lock** trait.
2. Apply items that improve the easiest locks first.
3. Burn low-value items to build wallet-level SP.
4. Lock traits progressively across many creatures.

---

## **Day 3–6 — First Locks Across the Wallet**
In the simulation, the wallet often has:
- 5–7 creatures with **1 locked trait** by Day 5
- 2–3 creatures with **2 locked traits**

Vibes are not consistently sent to all creatures; some hit the streak early and convert to **2-item/day** while others stay at 1/day.

---

## **Day 7–10 — Drip Hierarchy Forms**
Typical real-sim distribution:
- 8 creatures at 2 items/day
- 7 creatures at 1 item/day
- Total drip: ~22–24 items/day

This accelerates stabilization across the board.

Traits across the wallet begin to lock rapidly.

---

## **Day 11–15 — First Fully Stabilized Creatures**
Real sim behavior often shows:
- First stabilized creatures by Day 5–7
- Majority stabilized by Day 12–18

Completed creatures **stop dripping**, concentrating items on stragglers.

---

## **Day 15–25 — Resolving the Tail**
A few creatures still have:
- Multiple traits 10–15% off target
- Secondary interdependence slowing them down
- Rare/Epic items creating volatility

But wallet SP + 2-item drip ensures convergence.

By Day ~25–30:

**All 15 creatures stabilize.**

---

# 3. Unlucky Tail Example (Worst 5% Case)

This example is directly aligned with the behavior seen in multi-sim logs where a creature starts with maximum offsets and a streak of awkward drips.

## **Starting offsets (max difficulty)**
All traits start ±30% from target.

Example (representative real log structure):

| Trait        | Target | Current | Error |
|--------------|--------|---------|--------|
| Salinity     | 50     | 65      | +30% |
| pH           | 8      | 5.6     | -30% |
| Temperature  | 45     | 58.5    | +30% |
| Frequency    | 4400   | 3080    | -30% |

This is the worst-case distribution allowed by config.

## **Days 1–10 — Fighting Cross-Contamination**
Commons and Uncommons cause recurring secondary pushback:
- Fixing Salinity worsens pH
- Fixing pH worsens Temperature
- Fixing Temperature worsens Frequency

Vibes streak → 2-item drip helps break the stalemate.

---

## **Days 10–20 — First Locks via SP Burns**
Player burns many Commons for SP:
- SP climbs gradually into the 20s–30s
- Two traits eventually enter the 5% band
- Locks applied with 8SP and 10SP

With those traits locked, secondary chaos is eliminated.

---

## **Days 20–30 — Final Locks**
With 2-item/day drip and reduced chaos:
- Third trait enters band → lock
- Fourth trait enters band → lock

This tail creature stabilizes around **Day 26–32**, matching observed sim tail performance.

---

# 4. Summary of Real Player Journeys

Based on the final validated simulation:

- **Solo holders** stabilize in ~15–16 days, ~10 items total.
- **Mid to large wallets** stabilize most creatures in ~12–18 days.
- **Stragglers** stabilize by Day 25–30.
- **Epics** rarely appear (<2%) but add valuable correction options.
- **Hybrid drip** (1 item/day → 2 after streak) is the key engagement loop.
- SP from burns smooths out bad RNG.

These journeys illustrate the *actual lived experience* the system produces in v1.

For mechanics and contract requirements, see:
👉 `docs/stabilization-spec.md`

