# Creature Stabilization — Example Player Journeys (v1, Player-Like Sims)

These examples are based on the **player-like** simulation logic used in the final calibration runs. Numbers are lightly simplified for readability, but the sequences and decisions mirror what the sim actually does.

We show two perspectives:

1. A **single-creature holder**.
2. A **multi-creature whale wallet** that pools items and SP.

---

## 1. Single-Creature Journey (Solo Holder)

### Setup

- Holder has **1 creature**.
- On awakening (Day 0), the creature gets a **Starter Pack of 5 items** (Common/Uncommon/Rare only).
- Traits are around **5–25%** off their targets on each axis.
- No SP to start: `walletSP = 0`, `bondedSP = 0`.
- Vibes start at **9**.

Sample starting state (conceptual):

- Salinity: `~25%` high
- pH: `~10%` low
- Temperature: `~20%` high
- Frequency: `~12%` low

### Day 0 — Starter Pack, First Moves

- Player sends Vibes:
  - Vibes: `9 → 10`, streak: `0 → 1`.
- Starter Pack items, e.g.:
  - Common: Salinity −3, Temperature −1 (SP yield 1)
  - Uncommon: Temperature −4, pH −1 (SP yield 2)
  - Common: Frequency +2, Salinity +1 (SP yield 1)
  - Rare: pH +5, Frequency +2 (SP yield 3)
  - Common: Salinity −2, Temperature −1 (SP yield 1)

**What the player-like sim does:**

1. Looks at all traits and identifies which is **closest** to being within 5%.
2. Chooses items that move that trait toward the band, while not wrecking others.
3. **Does not** burn items for SP yet, because the first lock is **free**.

Result after a few applications on Day 0:

- One trait (say Salinity) lands **inside the 5% band**.
- Player uses the **free lock** on that trait.
- Remaining 2–3 items stay in inventory for later.

### Days 1–6 — 1 Item/Day, Building Toward the Next Locks

Each day:

- Drip adds **1 item/day**.
- Player sends Vibes most days:
  - Vibes often stays near 9–10.
  - Streak builds toward a 7-day max-Vibes streak.

The sim:

- Continues to apply items to whichever trait is currently **cheapest to fix** (fewest steps to reach lock band).
- Occasionally burns a **low-value item** purely for SP when:
  - A trait is already lockable, but
  - Wallet + bonded SP is just short of the lock cost.

By around **Day 6–8** in a typical run:

- Two traits are locked.
- Player has spent a mix of applied items and 1–2 item burns to pay for the second lock.

### Day 7+ — Vibes Streak and Drip Upgrade

If the player maintains a **7-day streak at Vibes 10**:

- Creature gains **+3 bonded SP**.
- Drip for that creature upgrades to **2 items/day** while the streak is active.

This usually happens around **Day 7–10** for a dedicated player.

Effect:

- Extra bonded SP pays a big chunk of the second or third lock cost.
- 2 items/day accelerates convergence for the remaining traits.

### Day 10–18 — Final Locks & Stabilization

Typical solo-creature run (from the sim):

- Stabilization rate: **100%** within 60 days.
- Average stabilization time: **~15.1 days**.
- Average items used: **~9.4 items**.

The last few days look like:

- One trait within ~6–10%: player applies 1–2 items to land it inside 5%.
- Burns just enough items to top up SP and pay the lock cost.
- Repeats for the final trait.

Once the **4th lock** completes:

- Creature is flagged as **stabilized**.
- `stabilizedAt` is recorded and the **7-day Resonance Phase** begins.

### Resonance Phase & Evolution

After stabilization:

- Player still sends Vibes occasionally.
- Needs **7 days** of elapsed time since `stabilizedAt`.
- On or after Day `stabilizedAt + 7`, if Vibes are **10**, the player can call `incubate`.

The sim typically:

- Reaches stabilization around Day 12–18.
- Has plenty of time to get Vibes back to 10 if they ever slip.

Once incubation is called, the creature is **evolved** and exits the stabilization game.

---

## 2. Multi-Creature Journey (Whale Wallet)

Now we look at a wallet with **many creatures** (e.g. 15+), based on a real whale wallet from the holder CSVs used in the sim.

### Setup

- Wallet holds **15 creatures**.
- Each creature:
  - Gets its own **5-item** Starter Pack on awakening.
  - Has 4 traits with random targets and 5–30% offsets.
- Wallet SP is shared across all creatures.
- Each creature has its own Vibes and streaks.

### Early Game — Day 0–3

What the sim does:

1. **Day 0:**
   - No drip yet, just Starter Packs.
   - The agent scans all traits across all 15 creatures.
   - It looks for the **cheapest locks**: traits already very close to their target bands.
   - It applies items from Starter Packs to push 1–3 traits (across different creatures) into the lock band.
   - Uses the **free first lock** per creature as soon as possible.

2. **Day 1–3:**
   - Drip starts: 1 item/day per **unstabilized** creature.
   - That's **15 items/day** at the very beginning.
   - The sim uses these items to:
     - Finish off second/third locks for the **"cheapest" creatures**.
     - Burn low-value items when a trait is ready to lock but SP is short.

By around Day 3–5 for this wallet in the log:

- Several creatures already have **2–3 traits locked**.
- A few might be fully stabilized.
- Others are still early but benefit from pooled SP.

### Mid Game — Day 7–14 (Streaks & Epics Start Appearing)

By Day 7+:

- Some creatures hit **7-day Vibes streaks**, granting:
  - +3 bonded SP per creature
  - 2 items/day drip for those specific creatures while streak is active.
- Epics begin to appear in the drip from **Day 7 onward** (2% of item drops).

In the multi-wallet sim:

- Epics are used sparingly as **puzzle tools**:
  - E.g. one Epic pulls a badly-off trait halfway toward its target.
  - It pushes other unlocked traits a bit further away, which is fine if those traits are still far out.
- More common behavior is still:
  - Use C/U/R items for steady, predictable moves.
  - Burn surplus low-impact items for SP at key locking moments.

### Late Game — Day 10–25 (Finishing the Long Tail)

Because the wallet pools everything:

- It prioritizes finishing creatures that are **closest to full stabilization**.
- It **does not hoard SP unnecessarily**:
  - Whenever a trait is within 5% and SP is available, it locks.
- Drip for creatures that have already stabilized stops, so item flow gradually concentrates on the long-tail creatures that still need help.

From the player-like multi-sim stats:

- All **2,661 creatures** across all wallets stabilized.
- Mean days to stabilization: **~12.9 days**.
- Average items per stabilized creature: **~7.73 items**.
- Whale wallets (>10 creatures): **62 wallets**, **0 failures**.

For the specific 15-creature wallet whose log we inspected:

- Some creatures stabilized extremely early (Day 0–3) using Starter Pack items and the free lock.
- Most creatures finished stabilization between **Days 6–20**.
- A few stragglers finished closer to **Day 30–40**, but still within the 60-day window.

### Resonance & Evolution for Whales

Once individual creatures are stabilized:

- Each tracks its own `stabilizedAt`.
- Each must complete a **7-day Resonance Phase**.
- On or after `stabilizedAt + 7`, with Vibes at 10, the owner can incubate that creature.

In practice for whales:

- Early stabilized creatures might finish resonance while the player is still working on others.
- It's up to the player whether to incubate immediately or batch incubations for a bigger reveal.

---

## 3. Takeaways For Design & UX

From these journeys and the supporting stats:

- **Difficulty feels right:**
  - Solo holders: ~15 days average, ~9–10 items.
  - Multi-wallets: ~13 days average, ~8 items per creature.
- **No hard fails:** with the player-like strategy, all creatures stabilized within 60 days in the multi-wallet sim.
- **Vibes matter:** streaks are meaningful but not mandatory; they reward engaged players without punishing casuals.
- **Epics are spice, not a crutch:** they show up later, give interesting options, and can be tuned post-launch if we want more fireworks.

For implementation, the contracts only need to enforce:

- The numeric rules (locks, bands, SP, Vibes, timers).
- The one-way nature of stabilization and evolution.

The UX can make all of this feel like:

- Tending a lab creature.
- Slowly coaxing it into a stable resonance.
- Then pushing it across the threshold into its evolved form.
