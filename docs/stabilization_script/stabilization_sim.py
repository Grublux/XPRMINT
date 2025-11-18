#!/usr/bin/env python3
"""
Stabilization Simulation v3

Models:
- 4 traits per creature: S, P (pH), T, F
- Interdependent adjustments via matrix
- Locking system: 1 free lock, then SP cost [8, 10, 12]
- SP comes from burning items; burning reduces item supply
- Items can be used to adjust traits OR burned for SP
- Wallet-level pooling of items and SP
- Starter packs + daily drip per unstabilized creature
- Realistic wallet distribution via holders.csv (address, balance)

This is a baseline; tune parameters & strategy as needed.
"""

import csv
import math
import random
import statistics
from collections import defaultdict, Counter
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

# -----------------------------
# CONFIG
# -----------------------------

TRAITS = ["S", "P", "T", "F"]  # Salinity, pH, Temperature, Frequency

# Trait starting error range (target is 0; errors in [-RANGE, RANGE])
START_ERROR_MIN = -25.0
START_ERROR_MAX = 25.0

# Stability band: |error| <= BAND => lockable
STABILITY_BAND = 5.0

# Number of starter items per creature
STARTER_ITEMS_PER_CREATURE = 5

# Daily drip: items per unstabilized creature per day
DAILY_ITEMS_PER_CREATURE = 1

# Max simulation days (hard cap)
MAX_DAYS = 60

# Lock costs (SP) after the free lock
LOCK_COSTS = [0, 8, 10, 12]  # lock #1 is free, then 8, 10, 12

# Interdependence matrix: how changing primary trait affects others.
# delta_primary * M[primary][other] is added to other's error.
INTERDEPENDENCE_MATRIX: Dict[str, Dict[str, float]] = {
    "S": {"S": 1.0, "P": 0.0, "T": 0.3, "F": -0.2},
    "P": {"S": 0.0, "P": 1.0, "T": 0.0, "F": 0.3},
    "T": {"S": 0.0, "P": -0.25, "T": 1.0, "F": 0.0},
    "F": {"S": 0.2, "P": 0.0, "T": 0.0, "F": 1.0},
}

# Item magnitude range (absolute adjustment to primary trait, before direction)
ITEM_MIN_MAG = 4.0
ITEM_MAX_MAG = 8.0

# Distribution of item rarities & their SP values when burned
RARITIES = {
    "basic": {"sp_value": 1, "weight": 0.6},
    "improved": {"sp_value": 2, "weight": 0.25},
    "advanced": {"sp_value": 3, "weight": 0.1},
    "epic": {"sp_value": 5, "weight": 0.04},
    "mythic": {"sp_value": 8, "weight": 0.01},
}

# Paths to holders CSV files; expected columns: address,balance
HOLDERS_CSV_PATHS = [
    "holders_pg1.csv",
    "holders_pg2.csv",
    "holders_pg3.csv",
    "holders_pg4.csv",
    "holders_pg5.csv",
    "holders_pg6.csv",
    "holders_pg7.csv",
    "holders_pg8.csv",
]

# If False, use synthetic holders distribution.
USE_HOLDERS_CSV = True

# Seed for reproducibility (set to None for randomness)
RNG_SEED = 42


# -----------------------------
# DATA STRUCTURES
# -----------------------------

@dataclass
class Item:
    """A consumable that can adjust one trait OR be burned for SP."""
    rarity: str
    primary_trait: str
    sp_value: int

    def magnitude(self) -> float:
        """Random magnitude for how much this item can move the primary trait."""
        return random.uniform(ITEM_MIN_MAG, ITEM_MAX_MAG)


@dataclass
class Creature:
    id: int
    owner: str  # wallet id / address
    errors: Dict[str, float]  # current error per trait
    locked: Dict[str, bool] = field(default_factory=lambda: {t: False for t in TRAITS})
    lock_count: int = 0
    stabilized: bool = False
    day_stabilized: Optional[int] = None
    items_used: int = 0
    sp_spent_on_locks: int = 0


@dataclass
class Wallet:
    address: str
    creature_ids: List[int] = field(default_factory=list)
    items: List[Item] = field(default_factory=list)
    sp: int = 0
    vibes_streak: int = 0  # consecutive days sending vibes while having unstabilized creatures

    def add_item(self, item: Item):
        self.items.append(item)

    def burn_item_for_sp(self, item_index: int) -> int:
        """Burn item at index for SP; returns SP gained."""
        item = self.items.pop(item_index)
        self.sp += item.sp_value
        return item.sp_value

    def next_lock_cost(self) -> int:
        """Cost of the next lock, based on how many locks the wallet has already paid for THIS creature.
        Note: In this baseline, lock costs are tracked per creature, not wallet.
        """
        # We'll compute per-creature based on creature.lock_count and LOCK_COSTS.
        raise NotImplementedError("Per-creature lock cost is computed outside Wallet.")


# -----------------------------
# UTILS
# -----------------------------

def weighted_choice(weights: Dict[str, float]) -> str:
    """Pick a key from dict where values are weights."""
    total = sum(weights.values())
    r = random.uniform(0, total)
    upto = 0
    for k, w in weights.items():
        upto += w
        if r <= upto:
            return k
    # fallback
    return list(weights.keys())[-1]


def create_random_item() -> Item:
    """Create a random item with rarity, primary trait, and SP value."""
    rarity = weighted_choice({k: v["weight"] for k, v in RARITIES.items()})
    sp_val = RARITIES[rarity]["sp_value"]
    primary_trait = random.choice(TRAITS)
    return Item(rarity=rarity, primary_trait=primary_trait, sp_value=sp_val)


def create_random_creature(creature_id: int = 0, owner: str = "solo") -> Creature:
    """Create a single creature with random starting errors."""
    errors = {t: random.uniform(START_ERROR_MIN, START_ERROR_MAX) for t in TRAITS}
    return Creature(id=creature_id, owner=owner, errors=errors)


def initialize_creatures_from_holders(holders: Dict[str, int]) -> Dict[int, Creature]:
    """Given holder address -> balance, create that many creatures per wallet."""
    creatures: Dict[int, Creature] = {}
    cid = 0
    for addr, balance in holders.items():
        for _ in range(balance):
            errors = {t: random.uniform(START_ERROR_MIN, START_ERROR_MAX) for t in TRAITS}
            creatures[cid] = Creature(id=cid, owner=addr, errors=errors)
            cid += 1
    return creatures


def load_holders_from_csv(path: str) -> Dict[str, int]:
    """Load holders from a single CSV with columns [Rank,Address,Address_Nametag,Quantity,Percentage]."""
    holders: Dict[str, int] = {}
    with open(path, "r", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        # CSV format: Rank,Address,Address_Nametag,Quantity,Percentage
        # Address is column 1 (index 1), Quantity is column 3 (index 3)
        for row in reader:
            if not row or len(row) < 4:
                continue
            # Address is in column 1, Quantity (balance) is in column 3
            addr = row[1].strip().strip('"')  # Remove quotes if present
            try:
                bal = int(float(row[3].strip().strip('"')))  # Handle potential decimals
            except (IndexError, ValueError):
                continue
            if bal <= 0:
                continue
            holders[addr] = holders.get(addr, 0) + bal
    return holders


def load_holders_from_multiple_csvs(paths: List[str]) -> Dict[str, int]:
    """Load holders from multiple CSV files, combining balances for duplicate addresses."""
    all_holders: Dict[str, int] = {}
    for path in paths:
        file_holders = load_holders_from_csv(path)
        for addr, bal in file_holders.items():
            all_holders[addr] = all_holders.get(addr, 0) + bal
    return all_holders


def create_synthetic_holders(num_wallets: int = 100, total_creatures: int = 1676) -> Dict[str, int]:
    """
    Create a synthetic holder distribution if we don't want to use real CSV.
    Roughly mimics a whale + mid + tail distribution.
    """
    holders: Dict[str, int] = {}
    remaining = total_creatures
    for i in range(num_wallets):
        if remaining <= 0:
            break
        # heavier sizes early, then taper
        if i < 5:
            bal = random.randint(20, 50)
        elif i < 20:
            bal = random.randint(5, 15)
        else:
            bal = random.randint(1, 5)
        bal = min(bal, remaining)
        holders[f"wallet_{i}"] = bal
        remaining -= bal
    if remaining > 0:
        holders[f"wallet_tail"] = remaining
    return holders


# -----------------------------
# CORE SIMULATION LOGIC
# -----------------------------

def apply_item_to_creature(item: Item, creature: Creature):
    """
    Use an item to adjust the creature:
    - Moves primary trait toward 0 by a random magnitude
    - Applies interdependence to other UNLOCKED traits
    """
    primary = item.primary_trait
    if creature.locked[primary]:
        # If primary is locked, this item is wasted in this simple model.
        return

    mag = item.magnitude()
    current = creature.errors[primary]
    direction = -1.0 if current > 0 else 1.0  # always move toward 0
    delta_primary = direction * mag

    # Apply deltas using interdependence matrix
    for t in TRAITS:
        if creature.locked[t]:
            continue  # locked traits do not move
        coeff = INTERDEPENDENCE_MATRIX[primary][t]
        creature.errors[t] += coeff * delta_primary


def can_lock_trait(creature: Creature, trait: str) -> bool:
    """Check if trait is lockable (in band and not already locked)."""
    return (not creature.locked[trait]) and (abs(creature.errors[trait]) <= STABILITY_BAND)


def get_next_lock_cost(creature: Creature) -> int:
    """SP cost for the next lock for this creature, based on its current lock_count."""
    idx = creature.lock_count  # 0..3
    if idx >= len(LOCK_COSTS):
        return math.inf
    return LOCK_COSTS[idx]


def try_lock_traits(wallet: Wallet, creature: Creature):
    """
    Attempt to lock any traits that are:
    - in stability band
    - unlocked
    - and for which the wallet can pay SP (or free lock)
    Locking order: lock the trait closest to 0 first (most 'solved').
    """
    while True:
        # Find lockable traits
        lockable = [
            t for t in TRAITS
            if can_lock_trait(creature, t)
        ]
        if not lockable:
            return

        # Sort by absolute error (closest to 0 first)
        lockable.sort(key=lambda t: abs(creature.errors[t]))

        # Cost for the next lock on this creature
        cost = get_next_lock_cost(creature)
        if cost == math.inf:
            return

        # Check if we can afford this lock
        if cost > 0 and wallet.sp < cost:
            # Not enough SP, stop trying to lock for now
            return

        # Take the best candidate
        trait = lockable[0]

        # Pay SP (if needed)
        if cost > 0:
            wallet.sp -= cost

        # Lock it
        creature.locked[trait] = True
        creature.lock_count += 1
        creature.sp_spent_on_locks += cost

        # Continue loop to see if we can lock more traits in same step


def wallet_step(wallet: Wallet, creatures: Dict[int, Creature]):
    """
    One day of actions for this wallet:
    - Use ALL available items this day
    - Always focus on stabilizing as many creatures as possible
      by working them one-by-one in order.
    - After each item use, try to lock traits, burning items for SP if needed.
    """

    # Helper: get next unstabilized creature owned by this wallet
    def get_active_creature() -> Optional[Creature]:
        for cid in wallet.creature_ids:
            c = creatures[cid]
            if not c.stabilized:
                return c
        return None

    # If wallet has no items, nothing to do this day
    if not wallet.items:
        return

    # Use ALL items this wallet has today, one by one
    while wallet.items:
        active = get_active_creature()
        if active is None:
            # All creatures stabilized for this wallet
            break

        # Use one item on the active creature
        item_index = 0  # pick the first item (you can later optimize this choice)
        item = wallet.items.pop(item_index)
        apply_item_to_creature(item, active)
        active.items_used += 1

        # First, try to lock traits with current SP
        try_lock_traits(wallet, active)

        # If we still have lockable traits but can't afford next lock, burn items for SP
        while True:
            lockable = [t for t in TRAITS if can_lock_trait(active, t)]
            if not lockable:
                break

            cost = get_next_lock_cost(active)
            if cost == math.inf:
                break

            if cost == 0 or wallet.sp >= cost:
                # We can pay for next lock now
                try_lock_traits(wallet, active)
                continue  # check if additional traits can be locked

            # Need more SP, burn lowest-SP item if available
            if not wallet.items:
                break

            burn_index = min(
                range(len(wallet.items)),
                key=lambda i: wallet.items[i].sp_value
            )
            wallet.burn_item_for_sp(burn_index)

        # After all that, if this creature is fully locked, mark stabilized
        if all(active.locked[t] for t in TRAITS):
            active.stabilized = True
            # Loop continues; next iteration will move to the next creature
            # and use remaining items on that one


def run_simulation():
    if RNG_SEED is not None:
        random.seed(RNG_SEED)

    # Load or synthesize holders
    if USE_HOLDERS_CSV:
        try:
            holders = load_holders_from_multiple_csvs(HOLDERS_CSV_PATHS)
            if not holders:
                print("Warning: No holders found in CSV files, falling back to synthetic holders.")
                holders = create_synthetic_holders()
            else:
                print(f"Loaded holders from {len(HOLDERS_CSV_PATHS)} CSV files.")
        except FileNotFoundError as e:
            print(f"Warning: CSV file not found: {e}, falling back to synthetic holders.")
            holders = create_synthetic_holders()
    else:
        holders = create_synthetic_holders()

    # Initialize creatures
    creatures = initialize_creatures_from_holders(holders)

    # Initialize wallets
    wallets: Dict[str, Wallet] = {
        addr: Wallet(address=addr) for addr in holders.keys()
    }
    for cid, creature in creatures.items():
        wallets[creature.owner].creature_ids.append(cid)

    # Give starter items
    for creature in creatures.values():
        w = wallets[creature.owner]
        for _ in range(STARTER_ITEMS_PER_CREATURE):
            w.add_item(create_random_item())

    # Simulation loop
    day = 0
    total_creatures = len(creatures)

    while day < MAX_DAYS:
        # Check if all stabilized
        if all(c.stabilized for c in creatures.values()):
            break

        # Daily drip: each unstabilized creature adds items to its owner's wallet
        if day > 0:
            for c in creatures.values():
                if not c.stabilized:
                    w = wallets[c.owner]
                    for _ in range(DAILY_ITEMS_PER_CREATURE):
                        w.add_item(create_random_item())

        # 🔹 Vibes streak logic: assume player "sends vibes" every day
        # for any wallet that still has at least one unstabilized creature.
        for w in wallets.values():
            has_unstabilized = any(
                not creatures[cid].stabilized for cid in w.creature_ids
            )
            if has_unstabilized:
                # Player shows up and sends vibes today
                w.vibes_streak += 1
                # Every 7 consecutive days, award 5 bonus items
                if w.vibes_streak > 0 and w.vibes_streak % 7 == 0:
                    for _ in range(5):
                        w.add_item(create_random_item())
            else:
                # Nothing left to care for; streak resets (or stays irrelevant)
                w.vibes_streak = 0

        # Each wallet takes one step (uses items, locks traits, etc.)
        for w in wallets.values():
            wallet_step(w, creatures)

        # Stamp day stabilized where applicable
        for c in creatures.values():
            if c.stabilized and c.day_stabilized is None:
                c.day_stabilized = day

        day += 1

    # -----------------------------
    # REPORT
    # -----------------------------
    stabilized = [c for c in creatures.values() if c.stabilized]
    not_stabilized = [c for c in creatures.values() if not c.stabilized]

    print("=== Simulation Results ===")
    print(f"Days simulated: {day}")
    print(f"Total creatures: {total_creatures}")
    print(f"Stabilized: {len(stabilized)} ({len(stabilized)/total_creatures*100:.2f}%)")
    print(f"Not stabilized: {len(not_stabilized)} ({len(not_stabilized)/total_creatures*100:.2f}%)")

    if stabilized:
        avg_days = sum(c.day_stabilized for c in stabilized if c.day_stabilized is not None) / len(stabilized)
        avg_items = sum(c.items_used for c in stabilized) / len(stabilized)
        avg_sp = sum(c.sp_spent_on_locks for c in stabilized) / len(stabilized)
        print(f"Average days to stabilization (stabilized only): {avg_days:.2f}")
        print(f"Average items used per stabilized creature: {avg_items:.2f}")
        print(f"Average SP spent on locks per stabilized creature: {avg_sp:.2f}")

    # Distribution of days
    day_counts = Counter(c.day_stabilized for c in stabilized if c.day_stabilized is not None)
    print("\nStabilization day distribution (day: count):")
    for d in sorted(day_counts):
        print(f"  Day {d}: {day_counts[d]}")

    # Lock count sanity check
    lock_counts = Counter(c.lock_count for c in creatures.values())
    print("\nLock count distribution (locks: num_creatures):")
    for lc in sorted(lock_counts):
        print(f"  {lc}: {lock_counts[lc]}")

    # SP spend distribution
    sp_counts = Counter(c.sp_spent_on_locks for c in stabilized)
    print("\nSP spent on locks distribution (SP: num_creatures):")
    for sp in sorted(sp_counts):
        print(f"  {sp}: {sp_counts[sp]}")


def run_single_player_trial(max_days: int = 180) -> int:
    """
    Run a single simulation for ONE wallet with ONE creature.
    Returns the number of days until stabilization, or max_days if not stabilized by then.
    """
    # Create a fresh creature and wallet
    creature = create_random_creature(creature_id=0, owner="solo")
    wallet = Wallet(address="solo")
    wallet.creature_ids = [0]

    # Day 0: starter pack (5 items)
    for _ in range(STARTER_ITEMS_PER_CREATURE):
        wallet.add_item(create_random_item())

    # Vibes streak per wallet
    wallet.vibes_streak = 0

    for day in range(max_days + 1):
        # Check win condition at the *start* of the loop
        if creature.stabilized:
            return day  # stabilized by this day

        # Daily drip: if not stabilized, add 1 item
        if day > 0 and not creature.stabilized:
            wallet.add_item(create_random_item())

        # Vibes: assume player "sends vibes" every day while unstabilized
        if not creature.stabilized:
            wallet.vibes_streak += 1
            if wallet.vibes_streak > 0 and wallet.vibes_streak % 7 == 0:
                # 5 bonus items every 7 days of consistent vibes
                for _ in range(5):
                    wallet.add_item(create_random_item())

        # One day of actions: use ALL items according to the same logic as before
        wallet_step(wallet, {0: creature})

        # If wallet_step marks it stabilized inside, next day loop will catch it

    # If we got here, we hit max_days without stabilizing
    return max_days


def run_single_player_simulation(
    num_trials: int = 1000,
    max_days: int = 180
):
    """
    Run many single-player trials and compute summary statistics.
    """
    results = []
    for _ in range(num_trials):
        days = run_single_player_trial(max_days=max_days)
        results.append(days)

    # Optionally, treat "max_days" as "did not stabilize" and filter them out
    stabilized_days = [d for d in results if d < max_days]
    failed_count = sum(1 for d in results if d >= max_days)

    print("\n=== Single-Player Simulation Results ===")
    print(f"Trials: {num_trials}")
    print(f"Failed to stabilize by day {max_days}: {failed_count} ({failed_count / num_trials * 100:.2f}%)")
    if stabilized_days:
        print(f"Min days: {min(stabilized_days)}")
        print(f"Max days (successful only): {max(stabilized_days)}")
        print(f"Mean days: {statistics.mean(stabilized_days):.2f}")
        print(f"Median days: {statistics.median(stabilized_days):.2f}")
        # For mode, bucket by day and pick the most common
        counts = {}
        for d in stabilized_days:
            counts[d] = counts.get(d, 0) + 1
        mode_day = max(counts, key=counts.get)
        print(f"Mode day (most common): {mode_day} (count {counts[mode_day]})")
    else:
        print("No successful stabilizations in the sample.")


if __name__ == "__main__":
    # Run the multi-wallet simulation
    run_simulation()
    # Run the single-player Monte Carlo
    run_single_player_simulation(num_trials=1000, max_days=180)
