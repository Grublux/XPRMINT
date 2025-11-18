# /sim/models.py

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import random
from . import config


@dataclass
class Item:
    rarity: str
    primary_trait: str
    primary_delta: int
    secondary_trait: str
    secondary_delta: int
    sp_yield: int
    epic_behavior: Optional[str] = None  # e.g. "all_closer", "focus_collapse"


@dataclass
class Creature:
    id: int
    targets: Dict[str, int]
    current: Dict[str, int]
    locks: Dict[str, bool] = field(default_factory=dict)
    vibes: int = config.VIBES_START
    last_vibes_day: int = 0
    consecutive_vibes_days: int = 0
    consecutive_vibes_at_max: int = 0  # Tracks consecutive days at VIBES_MAX
    has_completed_streak: bool = False  # True after first 7-day max vibes streak
    current_streak_active: bool = False  # True if currently maintaining max vibes streak
    bonded_sp: int = 0
    has_used_tonic: bool = False

    def __post_init__(self):
        if not self.locks:
            self.locks = {t: False for t in config.TRAITS}

    def error(self, trait: str) -> float:
        return abs(self.current[trait] - self.targets[trait])

    def total_error(self) -> float:
        return sum(self.error(t) for t in config.TRAITS if not self.locks[t])

    def is_trait_lockable(self, trait: str) -> bool:
        if self.locks[trait]:
            return False
        target = self.targets[trait]
        curr = self.current[trait]
        return abs(curr - target) <= config.LOCK_PCT * target

    def locked_count(self) -> int:
        return sum(1 for t in config.TRAITS if self.locks[t])

    def is_fully_stabilized(self) -> bool:
        return all(self.locks.values())

    def apply_decay(self, current_day: int):
        if self.last_vibes_day == 0:
            self.last_vibes_day = current_day
            return
        days_missed = current_day - self.last_vibes_day
        if days_missed > 0:
            self.vibes = max(config.VIBES_MIN, self.vibes - days_missed)
            self.last_vibes_day = current_day

    def send_vibes(self, current_day: int):
        # Apply decay first
        self.apply_decay(current_day)

        # Increase vibes toward max
        if self.vibes < config.VIBES_MAX:
            self.vibes += 1

        # Streak tracking for SP rewards (existing logic)
        if self.vibes == config.VIBES_MAX:
            # We consider this a "good vibes day" toward streak
            self.consecutive_vibes_days += 1
            if self.consecutive_vibes_days >= config.STREAK_LENGTH:
                self.bonded_sp += config.BONDED_SP_REWARD
                self.consecutive_vibes_days = 0
        else:
            # Broke the streak
            self.consecutive_vibes_days = 0

        # Track max vibes streak for drip upgrade
        if self.vibes == config.VIBES_MAX:
            self.consecutive_vibes_at_max += 1
            # When we reach 7 days at max, mark streak completion and activate
            if self.consecutive_vibes_at_max >= config.STREAK_LENGTH:
                self.has_completed_streak = True
                self.current_streak_active = True
        else:
            # Vibes dropped below max - reset streak counter and deactivate
            self.consecutive_vibes_at_max = 0
            self.current_streak_active = False

        self.last_vibes_day = current_day

    def apply_item(self, item: Item):
        """
        Apply an item to adjust creature traits.
        
        RULE: This method ONLY adjusts traits. It does NOT award any SP.
        - Consumes the item (caller must remove from inventory)
        - Adjusts primary trait and secondary trait (via interdependence)
        - Updates creature trait values and errors
        - DO NOT award any SP here - SP only comes from burning items
        """
        if item.rarity == config.RARITY_EPIC:
            self._apply_epic_item(item)
        else:
            self._apply_linear_item(item)
    
    def _apply_linear_item(self, item: Item):
        """Apply standard (non-epic) item with primary and secondary deltas."""
        # Primary trait
        pt = item.primary_trait
        if not self.locks[pt]:
            curr = self.current[pt]
            new_val = curr + item.primary_delta
            self.current[pt] = max(config.TRAIT_MIN, min(config.TRAIT_MAX, new_val))

        # Secondary trait
        st = item.secondary_trait
        if st and not self.locks[st]:
            curr = self.current[st]
            new_val = curr + item.secondary_delta
            self.current[st] = max(config.TRAIT_MIN, min(config.TRAIT_MAX, new_val))
    
    def _apply_epic_item(self, item: Item):
        """
        Epic effect: Rebalance the puzzle.
        - Identify the trait with largest absolute error.
        - Pull it significantly closer to target (halve error OR move to 2*LOCK_PCT).
        - Push all other unlocked traits 10% further away from target.
        """
        unlocked_traits = [t for t in config.TRAITS if not self.locks[t]]
        if not unlocked_traits:
            return
        
        # Determine worst trait
        worst_trait = None
        worst_error = -1
        for t in unlocked_traits:
            error = abs(self.current[t] - self.targets[t])
            if error > worst_error:
                worst_error = error
                worst_trait = t
        
        if worst_trait is None:
            return
        
        worst_err = self.current[worst_trait] - self.targets[worst_trait]
        worst_tgt = self.targets[worst_trait]
        
        LOCK_PCT = config.LOCK_PCT
        
        # Pull worst closer
        if worst_tgt != 0:
            dist_pct = abs(worst_err) / abs(worst_tgt)
        else:
            dist_pct = 1.0
        
        if dist_pct > 2 * LOCK_PCT:
            new_err = (2 * LOCK_PCT) * abs(worst_tgt) * (1 if worst_err > 0 else -1)
        else:
            new_err = worst_err * 0.5
        
        self.current[worst_trait] = int(max(config.TRAIT_MIN, min(config.TRAIT_MAX, round(worst_tgt + new_err))))
        
        # Push all others away
        for t in unlocked_traits:
            if t == worst_trait:
                continue
            cur = self.current[t]
            tgt = self.targets[t]
            err = cur - tgt
            self.current[t] = int(max(config.TRAIT_MIN, min(config.TRAIT_MAX, round(tgt + err * 1.10))))  # 10% further from target


@dataclass
class Wallet:
    address: str
    creatures: List[Creature] = field(default_factory=list)
    items: List[Item] = field(default_factory=list)
    sp_balance: int = 0

    def add_item(self, item: Item):
        self.items.append(item)

    def burn_item_for_sp(self, idx: int) -> int:
        """
        Burn an item to generate SP.
        
        RULE: This method ONLY generates SP. It does NOT adjust any traits.
        - Consumes the item from inventory
        - Awards SP to wallet balance
        - DO NOT adjust any creature traits here - trait changes only come from applying items
        """
        item = self.items.pop(idx)
        self.sp_balance += item.sp_yield
        return item.sp_yield

    def try_lock_trait(self, creature: Creature, trait: str) -> bool:
        if not creature.is_trait_lockable(trait):
            return False

        lock_index = creature.locked_count()
        if lock_index >= len(config.LOCK_COSTS):
            return False
        cost = config.LOCK_COSTS[lock_index]

        # Use bonded SP first
        bonded_used = min(creature.bonded_sp, cost)
        remaining_cost = cost - bonded_used

        if remaining_cost > self.sp_balance:
            return False

        creature.bonded_sp -= bonded_used
        self.sp_balance -= remaining_cost
        creature.locks[trait] = True
        return True

    def has_unstabilized_creatures(self) -> bool:
        return any(not c.is_fully_stabilized() for c in self.creatures)

    def choose_active_creature(self) -> Optional[Creature]:
        # Heuristic: choose the unstabilized creature with the fewest locks, then highest total error
        candidates = [c for c in self.creatures if not c.is_fully_stabilized()]
        if not candidates:
            return None
        candidates.sort(key=lambda c: (c.locked_count(), -c.total_error()))
        return candidates[0]

