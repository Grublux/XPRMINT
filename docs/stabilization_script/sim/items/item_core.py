"""
Item Core - Deterministic item generation matching Solidity ItemGenerator.

This module provides pure, deterministic functions for generating items
that will match exactly with the on-chain ItemGenerator.sol implementation.
"""

from dataclasses import dataclass
from typing import Optional
import hashlib

# Import catalog
try:
    from catalog import CATALOG, CATALOG_BY_RARITY, get_template, get_templates_by_rarity
    HAS_CATALOG = True
except ImportError:
    HAS_CATALOG = False
    print("WARNING: Catalog not available, falling back to procedural generation")

# Try to import keccak256 - fallback to sha256 if not available
try:
    import sha3
    HAS_KECCAK = True
    HAS_CRYPTO = False
except ImportError:
    try:
        from Crypto.Hash import SHA3_256
        HAS_KECCAK = True
        HAS_CRYPTO = True
    except ImportError:
        HAS_KECCAK = False
        HAS_CRYPTO = False
        print("WARNING: keccak256 not available. Install pysha3 or pycryptodome for full parity.")


# Rarity constants (matching Solidity)
RARITY_COMMON = 0
RARITY_UNCOMMON = 1
RARITY_RARE = 2
RARITY_EPIC = 3

RARITY_NAMES = {
    RARITY_COMMON: "common",
    RARITY_UNCOMMON: "uncommon",
    RARITY_RARE: "rare",
    RARITY_EPIC: "epic",
}

# Trait indices (matching Solidity)
TRAIT_SALINITY = 0
TRAIT_PH = 1
TRAIT_TEMPERATURE = 2
TRAIT_FREQUENCY = 3

TRAIT_NAMES = {
    TRAIT_SALINITY: "salinity",
    TRAIT_PH: "ph",
    TRAIT_TEMPERATURE: "temperature",
    TRAIT_FREQUENCY: "frequency",
}

# Primary delta ranges (matching spec)
PRIMARY_DELTAS = {
    RARITY_COMMON: (2, 3),
    RARITY_UNCOMMON: (3, 5),
    RARITY_RARE: (4, 6),
}

# Secondary scale range
SECONDARY_SCALE_MIN = 0.15
SECONDARY_SCALE_MAX = 0.30

# Interdependence mapping
INTERDEPENDENCE = {
    TRAIT_SALINITY: TRAIT_TEMPERATURE,
    TRAIT_TEMPERATURE: TRAIT_FREQUENCY,
    TRAIT_PH: TRAIT_FREQUENCY,
    TRAIT_FREQUENCY: TRAIT_TEMPERATURE,
}

# Epic unlock day
EPIC_UNLOCK_DAY = 7
EPIC_RARITY_FRACTION = 0.02  # 2%

# Base rarity weights (before epic unlock)
BASE_RARITY_WEIGHTS = {
    RARITY_COMMON: 0.60,
    RARITY_UNCOMMON: 0.25,
    RARITY_RARE: 0.15,
}


@dataclass
class SimItem:
    """Item structure matching on-chain ItemData."""
    rarity: str  # "common", "uncommon", "rare", "epic"
    primary_trait: str | None  # trait name or None
    primary_delta: int  # signed delta
    secondary_trait: str | None  # trait name or None
    secondary_delta: int  # signed delta
    epic_seed: int | None  # uint32 seed for epic items
    template_id: int | None = None  # Catalog template ID


def keccak256(data: bytes) -> bytes:
    """
    Compute keccak256 hash matching Solidity's keccak256.
    
    Args:
        data: Input bytes
    
    Returns:
        32-byte hash
    """
    if HAS_KECCAK:
        if HAS_CRYPTO:
            # Using pycryptodome (SHA3_256 is Keccak-256)
            k = SHA3_256.new()
            k.update(data)
            return k.digest()
        else:
            # Using pysha3
            k = sha3.keccak_256()
            k.update(data)
            return k.digest()
    else:
        # Fallback to sha256 (will not match Solidity!)
        return hashlib.sha256(data).digest()


def derive_seed(creature_id: int, day_index: int, global_entropy: bytes) -> bytes:
    """
    Deterministic seed derivation matching Solidity ItemGenerator.deriveSeed.
    
    Solidity: keccak256(abi.encodePacked(creatureId, dayIndex, globalEntropy))
    
    Args:
        creature_id: Creature identifier
        day_index: Current day index
        global_entropy: Global entropy bytes (32 bytes)
    
    Returns:
        32-byte seed
    """
    # Match Solidity abi.encodePacked semantics exactly
    # Solidity packs: uint256 (32 bytes) + uint256 (32 bytes) + bytes32 (32 bytes)
    combined = (
        creature_id.to_bytes(32, 'big') +
        day_index.to_bytes(32, 'big') +
        global_entropy
    )
    return keccak256(combined)


def uint256_from_bytes(b: bytes) -> int:
    """Convert bytes to uint256 (big-endian)."""
    return int.from_bytes(b[:32], 'big')


def uint8_from_seed(seed: bytes, offset: int) -> int:
    """Extract uint8 from seed at offset."""
    return seed[offset % 32] % 256


def uint16_from_seed(seed: bytes, offset: int) -> int:
    """Extract uint16 from seed at offset."""
    idx = offset % 32
    val = (seed[idx] << 8) | seed[(idx + 1) % 32]
    return val % 65536


def int16_from_seed(seed: bytes, offset: int, signed: bool = True) -> int:
    """Extract int16 from seed at offset (signed)."""
    val = uint16_from_seed(seed, offset)
    if signed and val >= 32768:
        return val - 65536
    return val


def rarity_for_day(day_index: int, seed: bytes) -> int:
    """
    Determine rarity for a given day, matching Solidity logic.
    
    Before Day 7: 60% Common, 25% Uncommon, 15% Rare
    After Day 7: 2% Epic, then 60/25/15 split for remaining 98%
    """
    r = uint256_from_bytes(seed) % 10000  # 0-9999 for precision
    
    if day_index < EPIC_UNLOCK_DAY:
        # Before epic unlock: C/U/R only
        if r < 6000:
            return RARITY_COMMON
        elif r < 8500:
            return RARITY_UNCOMMON
        else:
            return RARITY_RARE
    else:
        # After epic unlock: 2% epic chance
        if r < 200:  # 2% = 200/10000
            return RARITY_EPIC
        
        # Remaining 98% split: 60/25/15
        r2 = (r - 200) % 9800  # 0-9799
        if r2 < 5880:  # 60% of 98% = 58.8% of total
            return RARITY_COMMON
        elif r2 < 8330:  # 25% of 98% = 24.5% of total
            return RARITY_UNCOMMON
        else:
            return RARITY_RARE


def primary_trait_from_seed(seed: bytes) -> int:
    """Select primary trait index (0-3) from seed."""
    return uint8_from_seed(seed, 4) % 4


def primary_delta_from_seed(rarity: int, seed: bytes, direction: int) -> int:
    """
    Compute primary delta from seed.
    
    Args:
        rarity: Rarity constant (0-3)
        seed: Seed bytes
        direction: +1 to move toward target, -1 to move away
    
    Returns:
        Signed delta value
    """
    if rarity == RARITY_EPIC:
        # Epic doesn't use primary delta in the same way
        return 0
    
    min_delta, max_delta = PRIMARY_DELTAS[rarity]
    # Use seed to pick value in range
    range_size = max_delta - min_delta + 1
    offset = uint8_from_seed(seed, 8)
    magnitude = min_delta + (offset % range_size)
    
    return direction * magnitude


def secondary_trait_and_delta(
    primary_trait: int,
    primary_delta: int,
    seed: bytes
) -> tuple[int, int]:
    """
    Compute secondary trait and delta from interdependence.
    
    Args:
        primary_trait: Primary trait index
        primary_delta: Primary delta (signed)
        seed: Seed bytes
    
    Returns:
        (secondary_trait_index, secondary_delta)
    """
    secondary_trait = INTERDEPENDENCE[primary_trait]
    
    # Scale factor: 15-30% of primary magnitude
    scale_offset = uint8_from_seed(seed, 12)
    scale_range = SECONDARY_SCALE_MAX - SECONDARY_SCALE_MIN
    scale = SECONDARY_SCALE_MIN + (scale_offset % 100) / 100.0 * scale_range
    
    primary_magnitude = abs(primary_delta)
    secondary_magnitude = max(1, int(primary_magnitude * scale))
    secondary_delta = (1 if primary_delta > 0 else -1) * secondary_magnitude
    
    return secondary_trait, secondary_delta


def generate_item(creature_id: int, day_index: int, global_entropy: bytes) -> SimItem:
    """
    Generate a complete item deterministically using the catalog.
    
    Args:
        creature_id: Creature identifier
        day_index: Current day index
        global_entropy: Global entropy (32 bytes)
    
    Returns:
        SimItem with all fields populated from catalog template
    """
    seed = derive_seed(creature_id, day_index, global_entropy)
    
    # Determine rarity (same logic as before)
    rarity_idx = rarity_for_day(day_index, seed)
    rarity_name = RARITY_NAMES[rarity_idx]
    
    if not HAS_CATALOG:
        # Fallback to procedural generation if catalog not available
        return _generate_item_procedural(creature_id, day_index, global_entropy, seed, rarity_idx, rarity_name)
    
    # Get templates for this rarity
    templates = get_templates_by_rarity(rarity_name)
    
    if not templates:
        # No templates for this rarity - fallback
        return _generate_item_procedural(creature_id, day_index, global_entropy, seed, rarity_idx, rarity_name)
    
    # Select template ID deterministically from seed
    template_idx = uint256_from_bytes(seed) % len(templates)
    template = templates[template_idx]
    
    if rarity_idx == RARITY_EPIC:
        # Epic items use special logic, but we still track the template
        epic_seed = uint256_from_bytes(seed[:4] + seed[4:8]) % (2**32)
        return SimItem(
            rarity=rarity_name,
            primary_trait=None,
            primary_delta=0,
            secondary_trait=None,
            secondary_delta=0,
            epic_seed=epic_seed,
            template_id=template.id  # Track which epic template was selected
        )
    
    # For non-epic items, use template magnitudes directly
    # Direction will be determined at apply-time based on current vs target
    # For generation/testing, we use a deterministic direction from seed
    # In actual gameplay, direction is always toward target
    direction = 1 if (uint8_from_seed(seed, 16) % 2 == 0) else -1
    
    return SimItem(
        rarity=rarity_name,
        primary_trait=template.primary_trait,
        primary_delta=template.primary_delta * direction,  # Direction for testing; actual apply uses toward-target
        secondary_trait=template.secondary_trait,
        secondary_delta=template.secondary_delta * direction,
        epic_seed=None,
        template_id=template.id
    )


def _generate_item_procedural(
    creature_id: int,
    day_index: int,
    global_entropy: bytes,
    seed: bytes,
    rarity_idx: int,
    rarity_name: str
) -> SimItem:
    """Fallback procedural generation (original logic)."""
    if rarity_idx == RARITY_EPIC:
        epic_seed = uint256_from_bytes(seed[:4] + seed[4:8]) % (2**32)
        return SimItem(
            rarity=rarity_name,
            primary_trait=None,
            primary_delta=0,
            secondary_trait=None,
            secondary_delta=0,
            epic_seed=epic_seed
        )
    
    primary_trait_idx = primary_trait_from_seed(seed)
    primary_trait_name = TRAIT_NAMES[primary_trait_idx]
    
    direction = 1 if (uint8_from_seed(seed, 16) % 2 == 0) else -1
    primary_delta = primary_delta_from_seed(rarity_idx, seed, direction)
    
    secondary_trait_idx, secondary_delta = secondary_trait_and_delta(
        primary_trait_idx, primary_delta, seed
    )
    secondary_trait_name = TRAIT_NAMES[secondary_trait_idx]
    
    return SimItem(
        rarity=rarity_name,
        primary_trait=primary_trait_name,
        primary_delta=primary_delta,
        secondary_trait=secondary_trait_name,
        secondary_delta=secondary_delta,
        epic_seed=None
    )


def encode_item_id(item: SimItem, creature_id: int, day_index: int, global_entropy: bytes) -> int:
    """
    Encode item as templateId (catalog-based system).
    
    In the catalog-based system, itemId is simply the templateId.
    This maintains simplicity and allows direct lookup in ItemCatalog.
    """
    if item.template_id is not None:
        return item.template_id
    
    # Fallback: if no template_id, use old encoding scheme
    # This should not happen in catalog-based system, but kept for compatibility
    item_id = 0
    
    # Rarity (0-7)
    rarity_map = {"common": 0, "uncommon": 1, "rare": 2, "epic": 3}
    item_id |= rarity_map.get(item.rarity, 0)
    
    # Primary trait (8-15)
    if item.primary_trait:
        trait_map = {"salinity": 0, "ph": 1, "temperature": 2, "frequency": 3}
        primary_trait_idx = trait_map.get(item.primary_trait, 4)
    else:
        primary_trait_idx = 4  # None
    item_id |= (primary_trait_idx << 8)
    
    # Primary delta (16-31) - encode signed int16 as uint16
    primary_delta_uint16 = item.primary_delta & 0xFFFF
    item_id |= (primary_delta_uint16 << 16)
    
    # Secondary trait (32-47)
    if item.secondary_trait:
        secondary_trait_idx = trait_map.get(item.secondary_trait, 4)
    else:
        secondary_trait_idx = 4
    item_id |= (secondary_trait_idx << 32)
    
    # Secondary delta (48-63)
    secondary_delta_uint16 = item.secondary_delta & 0xFFFF
    item_id |= (secondary_delta_uint16 << 48)
    
    # Epic seed (64-95)
    if item.epic_seed is not None:
        item_id |= (item.epic_seed << 64)
    
    # Hash entropy (96-255) - keccak256 of (seed, creatureId, day)
    seed = derive_seed(creature_id, day_index, global_entropy)
    hash_input = seed + creature_id.to_bytes(32, 'big') + day_index.to_bytes(32, 'big')
    hash_bytes = keccak256(hash_input)
    hash_uint160 = int.from_bytes(hash_bytes[:20], 'big')  # 160 bits = 20 bytes
    item_id |= (hash_uint160 << 96)
    
    return item_id


def decode_item_id(item_id: int) -> SimItem:
    """
    Decode uint256 itemId back to SimItem.
    
    Reverse of encode_item_id.
    """
    rarity_idx = item_id & 0xFF
    rarity_name = RARITY_NAMES.get(rarity_idx, "common")
    
    primary_trait_idx = (item_id >> 8) & 0xFF
    primary_trait_name = TRAIT_NAMES.get(primary_trait_idx) if primary_trait_idx < 4 else None
    
    primary_delta_uint16 = (item_id >> 16) & 0xFFFF
    primary_delta = primary_delta_uint16
    if primary_delta >= 32768:
        primary_delta = primary_delta - 65536  # Convert to signed
    
    secondary_trait_idx = (item_id >> 32) & 0xFFFF
    secondary_trait_name = TRAIT_NAMES.get(secondary_trait_idx) if secondary_trait_idx < 4 else None
    
    secondary_delta_uint16 = (item_id >> 48) & 0xFFFF
    secondary_delta = secondary_delta_uint16
    if secondary_delta >= 32768:
        secondary_delta = secondary_delta - 65536
    
    epic_seed = (item_id >> 64) & 0xFFFFFFFF
    
    return SimItem(
        rarity=rarity_name,
        primary_trait=primary_trait_name,
        primary_delta=primary_delta,
        secondary_trait=secondary_trait_name,
        secondary_delta=secondary_delta,
        epic_seed=epic_seed if epic_seed > 0 and rarity_name == "epic" else None
    )

