# /sim/config.py

from dataclasses import dataclass
from typing import Dict, Tuple, List
import random

# Traits
TRAITS: List[str] = ["salinity", "ph", "temperature", "frequency"]

# Trait domain (normalized)
TRAIT_MIN = 0
TRAIT_MAX = 100

# Targets in mid-range
TARGET_MIN = 20
TARGET_MAX = 80

# Initial offsets: up to ±30% off target
OFFSET_MAX_PCT = 0.30  # 30%

# Lock window: within 5% of target
LOCK_PCT = 0.05  # 5%


# Rarity setup
RARITY_COMMON = "common"
RARITY_UNCOMMON = "uncommon"
RARITY_RARE = "rare"
RARITY_EPIC = "epic"

RARITY_WEIGHTS = {
    RARITY_COMMON: 0.60,
    RARITY_UNCOMMON: 0.25,
    RARITY_RARE: 0.10,
    RARITY_EPIC: 0.05,
}

# Item rarities for v1 (epic not included in base distribution)
ITEM_RARITIES = {
    "common": 0.60,
    "uncommon": 0.25,
    "rare": 0.15,
    # epic not included here; added by unlock logic below
}

# Primary delta ranges per rarity (absolute units)
# Lightly buffed from v2: +1 to upper bounds for ~15-20% stronger movement
PRIMARY_DELTAS = {
    RARITY_COMMON: (2, 3),      # v2: (1, 3) -> buffed upper bound
    RARITY_UNCOMMON: (3, 5),    # v2: (3, 4) -> buffed upper bound
    RARITY_RARE: (4, 6),        # v2: (4, 5) -> buffed upper bound
    RARITY_EPIC: (4, 6),        # placeholder – not used directly, since epics use special effect
}

# Secondary scaling factor as a fraction of primary magnitude
# Reduced by ~50% for weaker interdependence
SECONDARY_SCALE_RANGE = (0.15, 0.3)  # 15–30% of primary magnitude (was 30–50%)

# SP yield per rarity
SP_YIELD = {
    RARITY_COMMON: 1,
    RARITY_UNCOMMON: 2,
    RARITY_RARE: 3,
    RARITY_EPIC: 3,
}

# Interdependence matrix: primary_trait -> secondary_trait
# DEPRECATED: Now using item-specific secondary traits from catalog (see catalog.py ITEM_SECONDARY_TRAIT_MAP)
# Kept for reference and backward compatibility
INTERDEPENDENCE: Dict[str, str] = {
    "salinity": "temperature",
    "temperature": "frequency",
    "ph": "frequency",
    "frequency": "temperature",
}

# Vibes
VIBES_MIN = 0
VIBES_MAX = 10
VIBES_START = 9

# Streak
STREAK_LENGTH = 7
BONDED_SP_REWARD = 3

# Lock costs per creature
LOCK_COSTS = [0, 8, 10, 12]  # first, second, third, fourth lock

# Simulation defaults
SINGLE_MAX_DAYS = 180
MULTI_MAX_DAYS = 60

# Decision logic
MIN_IMPROVEMENT = 0.5  # Minimum error reduction required to apply an item
MAX_ACTIONS_PER_DAY = 30  # Maximum actions (locks + item uses) per creature per day

# Daily drip configuration
DRIP_ITEMS_PER_DAY = 1  # items per day for all unstabilized creatures
# DRIP_ITEMS_BEFORE_TWO_LOCKS = 2  # items per day until 2 traits are locked (not used in v3)
# DRIP_ITEMS_AFTER_TWO_LOCKS = 1   # items per day after 2 traits are locked (not used in v3)

# Resonance Tonic (one-time Day-14 boost) - DISABLED in v2
RESONANCE_TONIC_DAY = 14          # day when tonic is applied, if conditions met (not used)
RESONANCE_TONIC_FACTOR = 0.5      # moves the worst trait 50% closer to its target (not used)

# --- Epic unlock system ---
EPIC_UNLOCK_DAY = 7              # Epics appear starting Day 7
EPIC_RARITY_FRACTION = 0.02      # 2% Epic drop rate after unlock

# Random helpers

def choose_rarity() -> str:
    r = random.random()
    cumulative = 0.0
    for rarity, weight in RARITY_WEIGHTS.items():
        cumulative += weight
        if r <= cumulative:
            return rarity
    return RARITY_EPIC  # fallback


def choose_trait() -> str:
    return random.choice(TRAITS)


def random_sign(bias_toward_target: bool = True) -> int:
    """
    If bias_toward_target is True, the caller should decide sign based on
    whether we want to move toward or away from the target. This helper
    is just a fair ±1 by default.
    """
    return 1 if random.random() < 0.5 else -1


def pick_rarity_for_day(day: int) -> str:
    """
    Returns rarity for daily drip:
    - Before EPIC_UNLOCK_DAY → common/uncommon/rare only
    - After EPIC_UNLOCK_DAY → 2% epic, otherwise C/U/R
    """
    if day < EPIC_UNLOCK_DAY:
        # original C/U/R weights
        r = random.random()
        acc = 0.0
        for rarity, weight in ITEM_RARITIES.items():
            acc += weight
            if r <= acc:
                return rarity
        return "rare"
    
    # After unlock:
    r = random.random()
    if r <= EPIC_RARITY_FRACTION:
        return "epic"
    
    r2 = random.random()
    acc = 0.0
    for rarity, weight in ITEM_RARITIES.items():
        acc += weight
        if r2 <= acc:
            return rarity
    return "rare"

