"""
Apply Item - Trait movement logic matching on-chain CreatureStabilizer.

This module implements the exact trait adjustment logic that will be
used in the Solidity CreatureStabilizer contract.
"""

from typing import Dict
from dataclasses import dataclass
from .item_core import SimItem, TRAIT_NAMES, RARITY_EPIC, RARITY_NAMES

# Constants matching spec
TRAIT_MIN = 0
TRAIT_MAX = 100
LOCK_PCT = 0.05  # 5%


@dataclass
class CreatureTraitState:
    """Current state of creature traits."""
    targets: Dict[str, int]  # target values
    current: Dict[str, int]  # current values
    locked: Dict[str, bool]  # lock status


def clamp_value(value: int, min_val: int, max_val: int) -> int:
    """Clamp value to range."""
    return max(min_val, min(max_val, value))


def percent_error(current: int, target: int) -> float:
    """Calculate percent error from target."""
    if target == 0:
        return abs(current) / 100.0  # Fallback for zero target
    return abs(current - target) / abs(target)


def apply_linear_item(state: CreatureTraitState, item: SimItem) -> None:
    """
    Apply a Common/Uncommon/Rare item (linear movement).
    
    - Primary trait moves by primary_delta magnitude toward target
    - Secondary trait moves by secondary_delta magnitude toward target
    - Direction is determined by comparing current vs target
    - Locked traits are skipped
    """
    # Apply primary delta (magnitude from template, direction toward target)
    if item.primary_trait and not state.locked.get(item.primary_trait, False):
        current = state.current[item.primary_trait]
        target = state.targets[item.primary_trait]
        
        # Determine direction: toward target
        # item.primary_delta is magnitude; we need to apply it in the right direction
        # If item.primary_delta is already signed (from generation), use it
        # Otherwise, compute direction: if current < target, move up; if current > target, move down
        if item.primary_delta < 0:
            # Already has direction (from testing/generation)
            delta = item.primary_delta
        else:
            # Compute direction toward target
            if current < target:
                delta = item.primary_delta  # Move up
            elif current > target:
                delta = -item.primary_delta  # Move down
            else:
                delta = 0  # Already at target
        
        new_value = current + delta
        state.current[item.primary_trait] = clamp_value(new_value, TRAIT_MIN, TRAIT_MAX)
    
    # Apply secondary delta (magnitude from template, direction toward target)
    if item.secondary_trait and not state.locked.get(item.secondary_trait, False):
        current = state.current[item.secondary_trait]
        target = state.targets[item.secondary_trait]
        
        # Determine direction toward target
        if item.secondary_delta < 0:
            delta = item.secondary_delta
        else:
            if current < target:
                delta = item.secondary_delta
            elif current > target:
                delta = -item.secondary_delta
            else:
                delta = 0
        
        new_value = current + delta
        state.current[item.secondary_trait] = clamp_value(new_value, TRAIT_MIN, TRAIT_MAX)


def apply_epic_item(state: CreatureTraitState, item: SimItem) -> None:
    """
    Apply an Epic item (puzzle-shaping behavior).
    
    Epic logic:
    1. Find trait with largest percent error (worst trait)
    2. Pull it significantly closer (halve error or snap to 2*LOCK_PCT)
    3. Push all other unlocked traits 10% further away
    """
    unlocked_traits = [
        trait for trait in state.current.keys()
        if not state.locked.get(trait, False)
    ]
    
    if not unlocked_traits:
        return  # All traits locked, nothing to do
    
    # Find worst trait (largest percent error)
    worst_trait = None
    worst_error_pct = -1.0
    
    for trait in unlocked_traits:
        current = state.current[trait]
        target = state.targets[trait]
        error_pct = percent_error(current, target)
        
        if error_pct > worst_error_pct:
            worst_error_pct = error_pct
            worst_trait = trait
    
    if worst_trait is None:
        return
    
    # Pull worst trait closer
    worst_current = state.current[worst_trait]
    worst_target = state.targets[worst_trait]
    worst_error = worst_current - worst_target
    
    if worst_target != 0:
        dist_pct = abs(worst_error) / abs(worst_target)
    else:
        dist_pct = 1.0
    
    # If > 10% away (2*LOCK_PCT), snap to exactly 10% error
    # Otherwise, halve the error
    if dist_pct > 2 * LOCK_PCT:
        new_error = (2 * LOCK_PCT) * abs(worst_target) * (1 if worst_error > 0 else -1)
    else:
        new_error = worst_error * 0.5
    
    new_value = int(round(worst_target + new_error))
    state.current[worst_trait] = clamp_value(new_value, TRAIT_MIN, TRAIT_MAX)
    
    # Push all other unlocked traits 10% further away
    for trait in unlocked_traits:
        if trait == worst_trait:
            continue
        
        current = state.current[trait]
        target = state.targets[trait]
        error = current - target
        
        # Increase error by 10%
        new_error = error * 1.10
        new_value = int(round(target + new_error))
        state.current[trait] = clamp_value(new_value, TRAIT_MIN, TRAIT_MAX)


def apply_item_to_creature(state: CreatureTraitState, item: SimItem) -> None:
    """
    Apply an item to a creature's trait state.
    
    This is the main entry point matching on-chain applyItem logic.
    """
    rarity_idx = None
    for idx, name in RARITY_NAMES.items():
        if name == item.rarity:
            rarity_idx = idx
            break
    
    if rarity_idx == RARITY_EPIC:
        apply_epic_item(state, item)
    else:
        apply_linear_item(state, item)


def is_trait_lockable(state: CreatureTraitState, trait: str) -> bool:
    """
    Check if a trait is within the lock band (5%).
    
    Matches on-chain isLockable logic.
    """
    if state.locked.get(trait, False):
        return False
    
    current = state.current[trait]
    target = state.targets[trait]
    
    # Lock band: abs(current - target) / target <= LOCK_PCT
    if target == 0:
        return False  # Can't lock zero target
    
    distance_pct = abs(current - target) / abs(target)
    return distance_pct <= LOCK_PCT

