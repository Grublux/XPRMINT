# /sim/sim_single.py

import random
import os
import math
from typing import List
from . import config
from .models import Creature, Wallet, Item

# Debug flag for detailed logging
DEBUG_SINGLE = True


def generate_random_target() -> int:
    return random.randint(config.TARGET_MIN, config.TARGET_MAX)


def generate_initial_value(target: int) -> int:
    offset_factor = random.uniform(-config.OFFSET_MAX_PCT, config.OFFSET_MAX_PCT)
    
    # Ensure starting offset is never inside the lock window
    if abs(offset_factor) < config.LOCK_PCT:
        offset_factor = math.copysign(config.LOCK_PCT, offset_factor if offset_factor != 0 else 1)
    
    raw = target * (1 + offset_factor)
    return int(max(config.TRAIT_MIN, min(config.TRAIT_MAX, round(raw))))


def generate_creature(creature_id: int) -> Creature:
    targets = {t: generate_random_target() for t in config.TRAITS}
    current = {t: generate_initial_value(targets[t]) for t in config.TRAITS}
    return Creature(id=creature_id, targets=targets, current=current)


def apply_resonance_tonic(creature: Creature):
    """
    Move the single worst trait (largest absolute error) 50% closer to target.
    No SP, no interdependence. One-time use only.
    """
    if creature.has_used_tonic:
        return False
    
    # Find trait with largest absolute error
    worst_trait = None
    max_error = -1
    
    for trait in config.TRAITS:
        if creature.locks[trait]:
            continue  # Skip locked traits
        error = abs(creature.current[trait] - creature.targets[trait])
        if error > max_error:
            max_error = error
            worst_trait = trait
    
    if worst_trait is None:
        return False
    
    # Move 50% closer to target
    current_val = creature.current[worst_trait]
    target_val = creature.targets[worst_trait]
    diff = target_val - current_val
    move = round(diff * config.RESONANCE_TONIC_FACTOR)
    new_val = max(config.TRAIT_MIN, min(config.TRAIT_MAX, current_val + move))
    
    creature.current[worst_trait] = new_val
    creature.has_used_tonic = True
    return True


def generate_item_toward(creature: Creature, rarity: str = None) -> Item:
    """
    Basic item generator: choose rarity, trait, magnitude, and secondary
    deltas. We'll bias sign toward reducing error on the active creature.
    """
    if rarity is None:
        rarity = config.choose_rarity()

    primary_trait = config.choose_trait()
    primary_min, primary_max = config.PRIMARY_DELTAS.get(rarity, (3, 5))
    magnitude = random.randint(primary_min, primary_max)

    # Decide direction: move toward target 70% of time
    tgt = creature.targets[primary_trait]
    curr = creature.current[primary_trait]
    diff = tgt - curr
    if diff == 0:
        sign = 1 if random.random() < 0.5 else -1
    else:
        toward = diff > 0  # need to move up
        if random.random() < 0.7:
            sign = 1 if toward else -1
        else:
            sign = -1 if toward else 1

    primary_delta = sign * magnitude

    # Secondary trait via interdependence
    secondary_trait = config.INTERDEPENDENCE[primary_trait]
    scale = random.uniform(*config.SECONDARY_SCALE_RANGE)
    secondary_magnitude = max(1, round(abs(primary_delta) * scale))
    secondary_delta = sign * secondary_magnitude  # same direction

    sp_yield = config.SP_YIELD.get(rarity, 1)

    # Epic items use special puzzle-shaping logic, no epic_behavior field needed
    epic_behavior = None

    return Item(
        rarity=rarity,
        primary_trait=primary_trait,
        primary_delta=primary_delta,
        secondary_trait=secondary_trait,
        secondary_delta=secondary_delta,
        sp_yield=sp_yield,
        epic_behavior=epic_behavior,
    )


def run_single_sim(log_days: int = 14):
    random.seed(42)

    # Single wallet, single creature
    w = Wallet(address="single_player")
    c = generate_creature(0)
    w.creatures.append(c)

    # Starter pack: 5 items biased toward this creature
    for _ in range(5):
        w.add_item(generate_item_toward(c))

    stabilized_day = None
    total_items_used = 0
    total_items_burned = 0
    total_items_received = 5  # starter pack
    total_bonded_sp_earned = 0
    total_wallet_sp_used = 0
    lock_events = []
    
    # Setup logging file if DEBUG_SINGLE is enabled
    log_file = None
    if DEBUG_SINGLE:
        os.makedirs("sim/out", exist_ok=True)
        log_file = open("sim/out/single_sim_log_v_playerlike.txt", "w")
        log_file.write("=" * 70 + "\n")
        log_file.write("SINGLE CREATURE SIMULATION - DETAILED LOG\n")
        log_file.write("=" * 70 + "\n\n")

    for day in range(config.SINGLE_MAX_DAYS):
        # Track vibes before sending
        vibes_before = c.vibes
        consecutive_before = c.consecutive_vibes_days
        bonded_before = c.bonded_sp
        
        # Daily drip: hybrid streak-based (1 or 2 items per day)
        items_received_today = []
        if not c.is_fully_stabilized():
            # Streak-aware hybrid drip: 2 items/day if streak active, else 1
            if c.has_completed_streak and c.current_streak_active:
                daily_drip = 2
            else:
                daily_drip = config.DRIP_ITEMS_PER_DAY  # 1
            for _ in range(daily_drip):
                rarity = config.pick_rarity_for_day(day)
                new_item = generate_item_toward(c, rarity)
                w.add_item(new_item)
                items_received_today.append(new_item)
                total_items_received += 1

        # Send vibes each day (engaged player)
        c.send_vibes(day)
        
        # Resonance Tonic disabled in v2
        # tonic_applied = False
        # if day == config.RESONANCE_TONIC_DAY and not c.is_fully_stabilized() and not c.has_used_tonic:
        #     tonic_applied = apply_resonance_tonic(c)
        
        # Track vibes changes
        vibes_after = c.vibes
        consecutive_after = c.consecutive_vibes_days
        bonded_after = c.bonded_sp
        bonded_earned_today = bonded_after - bonded_before
        if bonded_earned_today > 0:
            total_bonded_sp_earned += bonded_earned_today
        
        # Calculate decay (before send_vibes, so we need to check what it was)
        # Since send_vibes applies decay internally, we calculate what it would have been
        if c.last_vibes_day == 0:
            days_missed = 0
        else:
            days_missed = max(0, day - c.last_vibes_day - 1)  # -1 because send_vibes sets last_vibes_day to current day
        vibes_decay = days_missed if days_missed > 0 else 0

        # Rational decision loop: lock-first, then movement
        # Allow up to MAX_ACTIONS_PER_DAY actions per creature per day
        max_actions = config.MAX_ACTIONS_PER_DAY
        actions = []

        for _ in range(max_actions):
            if c.is_fully_stabilized():
                break
            
            # STEP 1: Lock-first behavior - check if any trait is within lock window
            lockable_traits = [t for t in config.TRAITS if c.is_trait_lockable(t) and not c.locks[t]]

            if lockable_traits:
                # We have a lock opportunity - prioritize locking
                t = lockable_traits[0]
                lock_index = c.locked_count()
                lock_cost = config.LOCK_COSTS[lock_index] if lock_index < len(config.LOCK_COSTS) else 999
                
                # Calculate total SP available (bonded + wallet)
                total_sp_available = c.bonded_sp + w.sp_balance
                
                if total_sp_available >= lock_cost:
                    # We have enough SP - lock immediately
                    locked = w.try_lock_trait(c, t)
                    if locked:
                        wallet_sp_used = lock_cost - min(c.bonded_sp, lock_cost)
                        total_wallet_sp_used += wallet_sp_used
                        lock_events.append({
                            'day': day,
                            'trait': t,
                            'cost': lock_cost,
                            'bonded_sp_used': min(c.bonded_sp, lock_cost),
                            'wallet_sp_used': wallet_sp_used
                        })
                        actions.append(f"Locked {t} (cost: {lock_cost} SP, bonded: {min(c.bonded_sp, lock_cost)}, wallet: {wallet_sp_used})")
                        continue  # Continue to next action (may have more locks available)
                else:
                    # Not enough SP - burn items to get enough SP
                    sp_needed = lock_cost - total_sp_available
                    
                    # Check if we have enough items to burn to cover the gap
                    total_sp_from_items = sum(item.sp_yield for item in w.items)
                    if total_sp_from_items >= sp_needed:
                        # Burn items until we have enough SP
                        while c.bonded_sp + w.sp_balance < lock_cost and w.items:
                            # Sort items by SP yield (ascending) to burn cheapest first
                            sorted_items = sorted(enumerate(w.items), key=lambda x: x[1].sp_yield)
                            burn_idx = sorted_items[0][0]
                            burned_item = w.items[burn_idx]
                            sp_gained = w.burn_item_for_sp(burn_idx)
                            total_items_burned += 1
                            actions.append(f"Burned {burned_item.rarity} item for {sp_gained} SP")
                        
                        # Now try to lock again
                        if c.bonded_sp + w.sp_balance >= lock_cost:
                            locked = w.try_lock_trait(c, t)
                            if locked:
                                wallet_sp_used = lock_cost - min(c.bonded_sp, lock_cost)
                                total_wallet_sp_used += wallet_sp_used
                                lock_events.append({
                                    'day': day,
                                    'trait': t,
                                    'cost': lock_cost,
                                    'bonded_sp_used': min(c.bonded_sp, lock_cost),
                                    'wallet_sp_used': wallet_sp_used
                                })
                                actions.append(f"Locked {t} (cost: {lock_cost} SP, bonded: {min(c.bonded_sp, lock_cost)}, wallet: {wallet_sp_used})")
                                continue
                    else:
                        # Not enough items to burn - can't afford lock, move to item application
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
                        # Epic logic: find worst trait, pull closer, push others away
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
                    actions.append(f"Applied {item.rarity} item: {item.primary_trait}+{item.primary_delta}, {item.secondary_trait}+{item.secondary_delta} (error reduction: {best_improvement:.2f})")
                    continue  # Continue to next action (may have new lock opportunity)
                else:
                    # No beneficial item available - break for this creature today
                    break

        # Log to file if DEBUG_SINGLE is enabled
        if DEBUG_SINGLE and log_file:
            log_file.write(f"\n{'='*70}\n")
            log_file.write(f"Day {day}\n")
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
            
            log_file.write(f"\n  Vibes: {vibes_before} -> {vibes_after} (decay: {vibes_decay}, streak: {consecutive_before} -> {consecutive_after} days)\n")
            log_file.write(f"  Max Vibes Streak: {c.consecutive_vibes_at_max} days (completed: {c.has_completed_streak}, active: {c.current_streak_active})\n")
            log_file.write(f"  SP: bonded={c.bonded_sp} (earned today: {bonded_earned_today}), wallet={w.sp_balance}\n")
            log_file.write(f"\n  Items received today ({len(items_received_today)}):\n")
            for item in items_received_today:
                log_file.write(f"    - {item.rarity}: {item.primary_trait}+{item.primary_delta}, {item.secondary_trait}+{item.secondary_delta} (SP yield: {item.sp_yield})\n")
            log_file.write(f"  Items in inventory: {len(w.items)}\n")
            log_file.write(f"\n  Actions ({len(actions)}):\n")
            for a in actions:
                log_file.write(f"    - {a}\n")
            log_file.write(f"\n  Cumulative stats:\n")
            log_file.write(f"    Items received: {total_items_received}\n")
            log_file.write(f"    Items applied: {total_items_used}\n")
            log_file.write(f"    Items burned: {total_items_burned}\n")
            log_file.write(f"    Bonded SP earned: {total_bonded_sp_earned}\n")
            log_file.write(f"    Wallet SP used for locks: {total_wallet_sp_used}\n")
            log_file.write(f"    Locks completed: {len(lock_events)}\n")
            log_file.write("-" * 70 + "\n")
        
        # Also print if within log_days (for console output)
        if day < log_days:
            print(f"\n{'='*60}")
            print(f"Day {day}")
            print(f"{'='*60}")
            print(f"  Traits:")
            for t in config.TRAITS:
                error = abs(c.current[t] - c.targets[t])
                lockable = c.is_trait_lockable(t) if not c.locks[t] else False
                print(f"    {t}: {c.current[t]} / {c.targets[t]} (error: {error:.1f}, locked={c.locks[t]}, lockable={lockable})")
            print(f"\n  Vibes: {vibes_before} -> {vibes_after} (decay: {vibes_decay}, streak: {consecutive_before} -> {consecutive_after} days)")
            print(f"  SP: bonded={c.bonded_sp} (earned today: {bonded_earned_today}), wallet={w.sp_balance}")
            print(f"\n  Items received today ({len(items_received_today)}):")
            for item in items_received_today:
                print(f"    - {item.rarity}: {item.primary_trait}+{item.primary_delta}, {item.secondary_trait}+{item.secondary_delta} (SP yield: {item.sp_yield})")
            print(f"  Items in inventory: {len(w.items)}")
            print(f"\n  Actions ({len(actions)}):")
            for a in actions:
                print(f"    - {a}")
            print(f"\n  Cumulative stats:")
            print(f"    Items received: {total_items_received}")
            print(f"    Items applied: {total_items_used}")
            print(f"    Items burned: {total_items_burned}")
            print(f"    Bonded SP earned: {total_bonded_sp_earned}")
            print(f"    Wallet SP used for locks: {total_wallet_sp_used}")
            print(f"    Locks completed: {len(lock_events)}")
            print("-" * 60)

        if c.is_fully_stabilized() and stabilized_day is None:
            stabilized_day = day
            if DEBUG_SINGLE and log_file:
                log_file.write(f"\n{'='*70}\n")
                log_file.write(f"✓ STABILIZED on Day {day}\n")
                log_file.write(f"{'='*70}\n")
            # We keep running if you want, but we can also break here
            break
    
    # Close log file
    if DEBUG_SINGLE and log_file:
        log_file.write(f"\n{'='*70}\n")
        log_file.write("FINAL SUMMARY\n")
        log_file.write(f"{'='*70}\n")
        if stabilized_day is not None:
            log_file.write(f"✓ Stabilized on day: {stabilized_day}\n")
        else:
            log_file.write("✗ Not stabilized within max days\n")
        log_file.write(f"\nItems:\n")
        log_file.write(f"  Total received: {total_items_received}\n")
        log_file.write(f"  Total applied: {total_items_used}\n")
        log_file.write(f"  Total burned: {total_items_burned}\n")
        log_file.write(f"  Applied/Burned ratio: {total_items_used/(total_items_burned+1):.2f}\n")
        log_file.write(f"\nSP Economy:\n")
        log_file.write(f"  Bonded SP earned: {total_bonded_sp_earned}\n")
        log_file.write(f"  Wallet SP used for locks: {total_wallet_sp_used}\n")
        log_file.write(f"  Final wallet SP: {w.sp_balance}\n")
        log_file.write(f"  Final bonded SP: {c.bonded_sp}\n")
        log_file.write(f"\nLock Events ({len(lock_events)}):\n")
        for i, lock in enumerate(lock_events, 1):
            log_file.write(f"  {i}. Day {lock['day']}: {lock['trait']} (cost: {lock['cost']}, bonded: {lock['bonded_sp_used']}, wallet: {lock['wallet_sp_used']})\n")
        log_file.close()
        print(f"\n✓ Detailed log saved to sim/out/single_sim_log_v_playerlike.txt")

    print("\n" + "="*60)
    print("=== Single Sim Summary ===")
    print("="*60)
    if stabilized_day is not None:
        print(f"✓ Stabilized on day: {stabilized_day}")
    else:
        print("✗ Not stabilized within max days")
    print(f"\nItems:")
    print(f"  Total received: {total_items_received}")
    print(f"  Total applied: {total_items_used}")
    print(f"  Total burned: {total_items_burned}")
    print(f"  Applied/Burned ratio: {total_items_used/(total_items_burned+1):.2f}")
    print(f"\nSP Economy:")
    print(f"  Bonded SP earned: {total_bonded_sp_earned}")
    print(f"  Wallet SP used for locks: {total_wallet_sp_used}")
    print(f"  Final wallet SP: {w.sp_balance}")
    print(f"  Final bonded SP: {c.bonded_sp}")
    print(f"\nLock Events ({len(lock_events)}):")
    for i, lock in enumerate(lock_events, 1):
        print(f"  {i}. Day {lock['day']}: {lock['trait']} (cost: {lock['cost']}, bonded: {lock['bonded_sp_used']}, wallet: {lock['wallet_sp_used']})")
    print("="*60)


def run_single_sim_trials(num_trials: int = 1000):
    """Run multiple single-creature trials and collect stats."""
    import statistics
    import json
    import os
    
    stabilized_days = []
    items_used_list = []
    stabilized_count = 0
    
    for trial in range(num_trials):
        random.seed(42 + trial)  # Different seed per trial
        
        w = Wallet(address="trial_player")
        c = generate_creature(0)
        w.creatures.append(c)
        
        # Starter pack: 5 items
        for _ in range(5):
            w.add_item(generate_item_toward(c))
        
        stabilized_day = None
        items_used = 0
        
        for day in range(config.SINGLE_MAX_DAYS):
            # Daily drip: hybrid streak-based (1 or 2 items per day)
            if not c.is_fully_stabilized():
                # Streak-aware hybrid drip: 2 items/day if streak active, else 1
                if c.has_completed_streak and c.current_streak_active:
                    daily_drip = 2
                else:
                    daily_drip = config.DRIP_ITEMS_PER_DAY  # 1
                for _ in range(daily_drip):
                    rarity = config.pick_rarity_for_day(day)
                    w.add_item(generate_item_toward(c, rarity))
            
            # Send vibes
            c.send_vibes(day)
            
            # Decision loop (same as run_single_sim)
            max_actions = config.MAX_ACTIONS_PER_DAY
            for _ in range(max_actions):
                if c.is_fully_stabilized():
                    break
                
                # STEP 1: Lock-first
                lockable_traits = [t for t in config.TRAITS if c.is_trait_lockable(t) and not c.locks[t]]
                
                if lockable_traits:
                    t = lockable_traits[0]
                    lock_index = c.locked_count()
                    lock_cost = config.LOCK_COSTS[lock_index] if lock_index < len(config.LOCK_COSTS) else 999
                    total_sp_available = c.bonded_sp + w.sp_balance
                    
                    if total_sp_available >= lock_cost:
                        w.try_lock_trait(c, t)
                        continue
                    else:
                        sp_needed = lock_cost - total_sp_available
                        total_sp_from_items = sum(item.sp_yield for item in w.items)
                        if total_sp_from_items >= sp_needed:
                            # Burn items until we have enough SP
                            while c.bonded_sp + w.sp_balance < lock_cost and w.items:
                                sorted_items = sorted(enumerate(w.items), key=lambda x: x[1].sp_yield)
                                burn_idx = sorted_items[0][0]
                                w.burn_item_for_sp(burn_idx)
                            
                            # Try to lock again
                            if c.bonded_sp + w.sp_balance >= lock_cost:
                                w.try_lock_trait(c, t)
                                continue
                        else:
                            # Not enough items to burn - move to item application
                            pass
                else:
                    # STEP 2: No lock opportunity - apply items for movement
                    if not w.items:
                        break
                    
                    best_idx = None
                    best_improvement = 0.0
                    baseline_error = c.total_error()
                    
                    for idx, item in enumerate(w.items):
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
                        item = w.items.pop(best_idx)
                        c.apply_item(item)
                        items_used += 1
                        continue
                    else:
                        break
            
            if c.is_fully_stabilized() and stabilized_day is None:
                stabilized_day = day
                break
        
        if stabilized_day is not None:
            stabilized_count += 1
            stabilized_days.append(stabilized_day)
            items_used_list.append(items_used)
    
    # Calculate stats
    stabilization_rate = stabilized_count / num_trials
    avg_days = statistics.mean(stabilized_days) if stabilized_days else 0
    median_days = statistics.median(stabilized_days) if stabilized_days else 0
    avg_items_used = statistics.mean(items_used_list) if items_used_list else 0
    
    stats = {
        "runs": num_trials,
        "stabilized": stabilized_count,
        "stabilization_rate": stabilization_rate,
        "avg_days": avg_days,
        "median_days": median_days,
        "avg_items_used": avg_items_used,
    }
    
    # Save to JSON
    os.makedirs("sim/out", exist_ok=True)
    json_filename = "sim/out/single_sim_stats_v_playerlike.json"
    with open(json_filename, "w") as f:
        json.dump(stats, f, indent=2)
    
    print("\n=== Single Sim Summary (Trials) ===")
    print(f"Runs: {num_trials}")
    print(f"Stabilized: {stabilized_count} ({stabilization_rate*100:.2f}%)")
    print(f"Avg days: {avg_days:.2f}")
    print(f"Median days: {median_days:.2f}")
    print(f"Avg items used: {avg_items_used:.2f}")
    print(f"\n✓ Stats saved to {json_filename}")
    
    return stats


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "trials":
        num_trials = int(sys.argv[2]) if len(sys.argv) > 2 else 1000
        run_single_sim_trials(num_trials)
    else:
        run_single_sim()

