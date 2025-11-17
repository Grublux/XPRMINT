# /sim/sim_multi.py

import csv
import json
import random
import os
from collections import Counter, defaultdict
from typing import Dict, List
from . import config
from .models import Creature, Wallet, Item
from .sim_single import generate_creature, generate_item_toward

# Debug flag for detailed logging (set to wallet address to enable)
DEBUG_MULTI_WALLET = "0x0a591c55351ae0b214f80131266309270634de88"  # Wallet with 15 creatures


def run_multi_sim(csv_paths: List[str] = None):
    """
    Multi-wallet simulation using real holder distribution from CSV files.
    """
    random.seed(42)
    
    # Load wallet addresses from CSV files
    if csv_paths is None:
        # Auto-detect holders_pg*.csv files in parent directory
        import os
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        csv_paths = []
        for i in range(1, 10):  # Check pg1 through pg9
            csv_path = os.path.join(parent_dir, f"holders_pg{i}.csv")
            if os.path.exists(csv_path):
                csv_paths.append(csv_path)
        
        if not csv_paths:
            print("Warning: No holders_pg*.csv files found, falling back to synthetic holders.")
            csv_paths = None
    
    wallets: Dict[str, Wallet] = {}
    creatures: Dict[int, Creature] = {}
    creature_id_counter = 0
    
    if csv_paths:
        print(f"Loading holders from {len(csv_paths)} CSV file(s)...")
        for csv_path in csv_paths:
            with open(csv_path, 'r') as f:
                reader = csv.reader(f)
                next(reader)  # Skip header
                for row in reader:
                    if len(row) < 4:
                        continue
                    address = row[1].strip()  # Address is column 1 (0-indexed)
                    try:
                        quantity = int(row[3]) if len(row) > 3 and row[3].strip() else 1  # Quantity is column 3
                    except (ValueError, IndexError):
                        quantity = 1
                    
                    if address not in wallets:
                        wallets[address] = Wallet(address=address)
                    
                    # Create creatures for this wallet
                    for _ in range(quantity):
                        c = generate_creature(creature_id_counter)
                        creatures[creature_id_counter] = c
                        wallets[address].creatures.append(c)
                        creature_id_counter += 1
    else:
        # Synthetic fallback
        print("Warning: No holders found in CSV files, falling back to synthetic holders.")
        for i in range(100):
            address = f"wallet_{i}"
            wallets[address] = Wallet(address=address)
            for _ in range(random.randint(1, 5)):
                c = generate_creature(creature_id_counter)
                creatures[creature_id_counter] = c
                wallets[address].creatures.append(c)
                creature_id_counter += 1
    
    print(f"Loaded {len(wallets)} unique wallet addresses")
    print(f"Total creatures: {creature_id_counter}")
    
    # Starter packs: 5 items per creature
    for w in wallets.values():
        for c in w.creatures:
            for _ in range(5):
                w.add_item(generate_item_toward(c))
    
    # Tracking
    total_items_used = 0
    total_items_burned = 0
    total_sp_from_burns = 0
    total_wallet_sp_used = 0
    total_bonded_sp_earned = 0
    
    stabilized_count = 0
    day_stabilized_dist = []
    
    whale_wallets = [w for w in wallets.values() if len(w.creatures) > 10]
    whale_failures = 0
    creatures_stabilized_with_bonded_only = 0
    creatures_requiring_30plus_items = 0
    
    # Setup logging file if DEBUG_MULTI_WALLET is enabled
    log_file = None
    debug_wallet = None
    if DEBUG_MULTI_WALLET:
        debug_wallet = wallets.get(DEBUG_MULTI_WALLET)
        if debug_wallet:
            os.makedirs("sim/out", exist_ok=True)
            log_filename = f"sim/out/multi_sim_log_playerlike_{DEBUG_MULTI_WALLET[:10]}.txt"
            log_file = open(log_filename, "w")
            log_file.write("=" * 70 + "\n")
            log_file.write(f"MULTI-WALLET SIMULATION - DETAILED LOG\n")
            log_file.write(f"Wallet: {DEBUG_MULTI_WALLET}\n")
            log_file.write(f"Creatures: {len(debug_wallet.creatures)}\n")
            log_file.write("=" * 70 + "\n\n")
    
    for day in range(config.MULTI_MAX_DAYS):
        day_stabilized = 0
        
        for w in wallets.values():
            # Skip if wallet has no unstabilized creatures
            if not w.has_unstabilized_creatures():
                continue
            
            # Check if this is the debug wallet
            is_debug_wallet = (DEBUG_MULTI_WALLET and w.address == DEBUG_MULTI_WALLET)
            
            # Daily drip per unstabilized creature: hybrid streak-based (1 or 2 items per day)
            for c in w.creatures:
                if not c.is_fully_stabilized():
                    # Streak-aware hybrid drip: 2 items/day if streak active, else 1
                    if c.has_completed_streak and c.current_streak_active:
                        daily_drip = 2
                    else:
                        daily_drip = config.DRIP_ITEMS_PER_DAY  # 1
                    for _ in range(daily_drip):
                        rarity = config.pick_rarity_for_day(day)
                        w.add_item(generate_item_toward(c, rarity))
                    
                    # Send vibes each day to maximize streak SP
                    bonded_before = c.bonded_sp
                    c.send_vibes(day)
                    bonded_earned = c.bonded_sp - bonded_before
                    if bonded_earned > 0:
                        total_bonded_sp_earned += bonded_earned
            
            # V3 PER-CREATURE GREEDY LOGIC
            # Process each creature independently with lock-first, then movement
            for c in w.creatures:
                if c.is_fully_stabilized():
                    continue
                
                # Allow multiple actions per creature per day (up to MAX_ACTIONS_PER_DAY)
                max_actions = config.MAX_ACTIONS_PER_DAY
                for action_round in range(max_actions):
                    if c.is_fully_stabilized():
                        break
                    
                    # STEP 1: Lock-first behavior - check if any trait is within lock window
                    lockable_traits = [t for t in config.TRAITS if c.is_trait_lockable(t) and not c.locks[t]]
                    
                    if lockable_traits:
                        # We have a lock opportunity - prioritize locking
                        t = lockable_traits[0]  # Lock first available
                        lock_index = c.locked_count()
                        lock_cost = config.LOCK_COSTS[lock_index] if lock_index < len(config.LOCK_COSTS) else 999
                        
                        # Calculate total SP available (bonded + wallet)
                        total_sp_available = c.bonded_sp + w.sp_balance
                        
                        if total_sp_available >= lock_cost:
                            # We have enough SP - lock immediately
                            wallet_sp_before = w.sp_balance
                            locked = w.try_lock_trait(c, t)
                            if locked:
                                wallet_sp_used = wallet_sp_before - w.sp_balance
                                total_wallet_sp_used += wallet_sp_used
                                # Continue to next action round (may have more locks)
                                continue
                        else:
                            # Not enough SP - burn items to get enough SP
                            sp_needed = lock_cost - total_sp_available
                            
                            # Check if we have enough items to burn to cover the gap
                            total_sp_from_items = sum(item.sp_yield for item in w.items)
                            if total_sp_from_items >= sp_needed:
                                # Burn items until we have enough SP
                                while c.bonded_sp + w.sp_balance < lock_cost and w.items:
                                    sorted_items = sorted(enumerate(w.items), key=lambda x: x[1].sp_yield)
                                    burn_idx = sorted_items[0][0]
                                    sp_gained = w.burn_item_for_sp(burn_idx)
                                    total_items_burned += 1
                                    total_sp_from_burns += sp_gained
                                
                                # Try to lock again
                                if c.bonded_sp + w.sp_balance >= lock_cost:
                                    wallet_sp_before = w.sp_balance
                                    locked = w.try_lock_trait(c, t)
                                    if locked:
                                        wallet_sp_used = wallet_sp_before - w.sp_balance
                                        total_wallet_sp_used += wallet_sp_used
                                        continue
                            else:
                                # Not enough items to burn - move to item application
                                pass
                    else:
                        # STEP 2: No lock opportunity - apply items for movement (if beneficial)
                        if not w.items:
                            break  # No items available
                        
                        # Only apply items that reduce total error by at least MIN_IMPROVEMENT
                        best_idx = None
                        best_improvement = 0.0
                        baseline_error = c.total_error()
                        
                        # Try each item hypothetically
                        for idx, item in enumerate(w.items):
                            # Clone creature state minimally
                            temp_curr = c.current.copy()
                            temp_locks = c.locks.copy()
                            
                            # Simulate apply (handle epic vs linear)
                            if item.rarity == config.RARITY_EPIC:
                                unlocked_traits = [t for t in config.TRAITS if not temp_locks[t]]
                                if unlocked_traits:
                                    worst_trait = max(unlocked_traits, key=lambda t: abs(temp_curr[t] - c.targets[t]))
                                    worst_err = temp_curr[worst_trait] - c.targets[worst_trait]
                                    worst_tgt = c.targets[worst_trait]
                                    
                                    if worst_tgt != 0:
                                        dist_pct = abs(worst_err) / abs(worst_tgt)
                                    else:
                                        dist_pct = 1.0
                                    
                                    if dist_pct > 2 * config.LOCK_PCT:
                                        new_err = (2 * config.LOCK_PCT) * abs(worst_tgt) * (1 if worst_err > 0 else -1)
                                    else:
                                        new_err = worst_err * 0.5
                                    
                                    temp_curr[worst_trait] = int(max(config.TRAIT_MIN, min(config.TRAIT_MAX, round(worst_tgt + new_err))))
                                    
                                    for t in unlocked_traits:
                                        if t != worst_trait:
                                            cur = temp_curr[t]
                                            tgt = c.targets[t]
                                            err = cur - tgt
                                            temp_curr[t] = int(max(config.TRAIT_MIN, min(config.TRAIT_MAX, round(tgt + err * 1.10))))
                            else:
                                # Linear item logic
                                if not temp_locks[item.primary_trait]:
                                    new_val = max(config.TRAIT_MIN, min(config.TRAIT_MAX, temp_curr[item.primary_trait] + item.primary_delta))
                                    temp_curr[item.primary_trait] = new_val
                                if item.secondary_trait and not temp_locks[item.secondary_trait]:
                                    new_val = max(config.TRAIT_MIN, min(config.TRAIT_MAX, temp_curr[item.secondary_trait] + item.secondary_delta))
                                    temp_curr[item.secondary_trait] = new_val
                            
                            temp_error = sum(abs(temp_curr[t] - c.targets[t]) for t in config.TRAITS if not temp_locks[t])
                            improvement = baseline_error - temp_error
                            if improvement > best_improvement:
                                best_improvement = improvement
                                best_idx = idx
                        
                        if best_idx is not None and best_improvement >= config.MIN_IMPROVEMENT:
                            # Apply the best item
                            item = w.items.pop(best_idx)
                            c.apply_item(item)
                            total_items_used += 1
                            # Track items used per creature
                            if not hasattr(c, "_items_used"):
                                c._items_used = 0
                            c._items_used += 1
                            # Continue to next action round (may have new lock opportunity)
                            continue
                        else:
                            # No beneficial movement available - break for this creature
                            break
                
                # Log debug wallet details
                if is_debug_wallet and log_file:
                    # Log at start of day for each creature
                    if not hasattr(c, "_last_logged_day") or c._last_logged_day != day:
                        c._last_logged_day = day
                        log_file.write(f"\n{'='*70}\n")
                        log_file.write(f"Day {day} - Creature {c.id}\n")
                        log_file.write(f"{'='*70}\n")
                        
                        # Drip status
                        if not c.is_fully_stabilized():
                            drip_status = "2 items/day (streak active)" if (c.has_completed_streak and c.current_streak_active) else "1 item/day"
                            log_file.write(f"  Drip: {drip_status}\n")
                        
                        log_file.write(f"  Traits:\n")
                        for t in config.TRAITS:
                            error = abs(c.current[t] - c.targets[t])
                            lockable = c.is_trait_lockable(t) if not c.locks[t] else False
                            log_file.write(f"    {t}: {c.current[t]} / {c.targets[t]} (error: {error:.1f}, locked={c.locks[t]}, lockable={lockable})\n")
                        
                        log_file.write(f"  Vibes: {c.vibes}, Max Vibes Streak: {c.consecutive_vibes_at_max} days (completed: {c.has_completed_streak}, active: {c.current_streak_active})\n")
                        log_file.write(f"  SP: bonded={c.bonded_sp}, wallet={w.sp_balance}\n")
                        log_file.write(f"  Items in inventory: {len(w.items)}\n")
                        items_used = getattr(c, "_items_used", 0)
                        log_file.write(f"  Items used so far: {items_used}\n")
                
                # End-of-day stabilization check for this creature
                if c.is_fully_stabilized() and getattr(c, "_stabilized_day", None) is None:
                    c._stabilized_day = day
                    day_stabilized += 1
                    if is_debug_wallet and log_file:
                        log_file.write(f"\n  ✓ STABILIZED on Day {day}\n")
                    if c.bonded_sp > 0 and w.sp_balance == 0:
                        creatures_stabilized_with_bonded_only += 1
                    items_used_approx = getattr(c, "_items_used", 0)
                    if items_used_approx >= 30:
                        creatures_requiring_30plus_items += 1
        
        stabilized_count += day_stabilized
        if day_stabilized > 0:
            day_stabilized_dist.extend([day] * day_stabilized)
        
        # Check if all stabilized
        if all(c.is_fully_stabilized() for c in creatures.values()):
            break
    
    # Close log file
    if DEBUG_MULTI_WALLET and log_file:
        log_file.write(f"\n{'='*70}\n")
        log_file.write("FINAL SUMMARY\n")
        log_file.write(f"{'='*70}\n")
        if debug_wallet:
            stabilized_count = sum(1 for c in debug_wallet.creatures if c.is_fully_stabilized())
            log_file.write(f"Wallet: {DEBUG_MULTI_WALLET}\n")
            log_file.write(f"Creatures stabilized: {stabilized_count}/{len(debug_wallet.creatures)}\n")
            for c in debug_wallet.creatures:
                items_used = getattr(c, "_items_used", 0)
                stabilized_day = getattr(c, "_stabilized_day", None)
                log_file.write(f"  Creature {c.id}: stabilized={c.is_fully_stabilized()}, day={stabilized_day}, items_used={items_used}\n")
        log_file.close()
        print(f"\n✓ Detailed log saved to sim/out/multi_sim_log_playerlike_{DEBUG_MULTI_WALLET[:10]}.txt")
    
    # Calculate final stats
    total_creatures = len(creatures)
    stabilized = sum(1 for c in creatures.values() if c.is_fully_stabilized())
    unstabilized = total_creatures - stabilized
    
    # Days to stabilization stats
    if day_stabilized_dist:
        import statistics
        mean_days = statistics.mean(day_stabilized_dist)
        median_days = statistics.median(day_stabilized_dist)
        min_days = min(day_stabilized_dist)
        max_days = max(day_stabilized_dist)
    else:
        mean_days = median_days = min_days = max_days = 0
    
    # Items stats
    items_per_stabilized = total_items_used / stabilized if stabilized > 0 else 0
    
    # SP stats
    total_sp_from_streaks = total_bonded_sp_earned
    total_sp_consumed = total_wallet_sp_used
    
    # Histogram
    day_hist = Counter(day_stabilized_dist)
    
    # Items used distribution
    items_used_dist = Counter()
    for c in creatures.values():
        if c.is_fully_stabilized():
            items_used = getattr(c, "_items_used", 0)
            items_used_dist[items_used] = items_used_dist.get(items_used, 0) + 1
    
    # Whale stats
    for w in whale_wallets:
        if not any(c.is_fully_stabilized() for c in w.creatures):
            whale_failures += 1
    
    # Build stats dict
    stats = {
        "total_creatures": total_creatures,
        "stabilized": stabilized,
        "unstabilized": unstabilized,
        "stabilization_rate": (stabilized / total_creatures * 100) if total_creatures > 0 else 0,
        "days_to_stabilization": {
            "mean": mean_days,
            "median": median_days,
            "min": int(min_days),
            "max": int(max_days),
        },
        "histogram": {str(k): v for k, v in sorted(day_hist.items())},
        "items": {
            "total_used": total_items_used,
            "total_burned": total_items_burned,
            "avg_per_stabilized": items_per_stabilized,
        },
        "items_used_distribution": {str(k): v for k, v in sorted(items_used_dist.items())},
        "sp_economy": {
            "total_from_burns": total_sp_from_burns,
            "total_from_streaks": total_sp_from_streaks,
            "total_consumed": total_sp_consumed,
        },
        "creatures_stabilized_with_bonded_only": creatures_stabilized_with_bonded_only,
        "creatures_requiring_30plus_items": creatures_requiring_30plus_items,
        "whale_wallets": len(whale_wallets),
        "whale_failures": whale_failures,
    }
    
    # Print summary
    print("\n=== Multi Sim Summary ===")
    print(f"Total creatures: {total_creatures}")
    print(f"Stabilized: {stabilized} ({stats['stabilization_rate']:.2f}%)")
    print(f"Unstabilized: {unstabilized} ({100 - stats['stabilization_rate']:.2f}%)")
    print(f"\nDays to Stabilization:")
    print(f"  Mean: {mean_days:.2f}")
    print(f"  Median: {median_days:.2f}")
    print(f"  Min/Max: {int(min_days)} / {int(max_days)}")
    print(f"\nItems:")
    print(f"  Total used: {total_items_used}")
    print(f"  Total burned: {total_items_burned}")
    print(f"  Avg per stabilized creature: {items_per_stabilized:.2f}")
    print(f"\nSP Economy:")
    print(f"  Total SP from item burns: {total_sp_from_burns}")
    print(f"  Total SP from streaks: {total_sp_from_streaks}")
    print(f"  Total SP consumed by locks: {total_sp_consumed}")
    print(f"\nSpecial Stats:")
    print(f"  Creatures stabilized with bonded SP only: {creatures_stabilized_with_bonded_only}")
    print(f"  Creatures requiring 30+ items: {creatures_requiring_30plus_items}")
    print(f"  Whale wallets (>10 creatures): {len(whale_wallets)}")
    print(f"  Whale wallets with 0 stabilized: {whale_failures}")
    
    # Save to JSON
    import os
    os.makedirs("sim/out", exist_ok=True)
    json_filename = "sim/out/multi_sim_stats_v_playerlike.json"
    with open(json_filename, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"\n✓ Detailed stats saved to {json_filename}")


if __name__ == "__main__":
    import sys
    csv_paths = sys.argv[1:] if len(sys.argv) > 1 else None
    run_multi_sim(csv_paths)
