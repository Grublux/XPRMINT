"""
Item Catalog - Normalized catalog sourced from canonical_item_list.md

This module parses the canonical item list and creates a stable catalog
of ItemTemplate objects that can be used for deterministic item generation.
"""

import json
import random
from dataclasses import dataclass
from typing import Optional, List, Dict
from pathlib import Path

# Import constants from item_core
from item_core import (
    RARITY_COMMON, RARITY_UNCOMMON, RARITY_RARE, RARITY_EPIC,
    RARITY_NAMES,
    TRAIT_SALINITY, TRAIT_PH, TRAIT_TEMPERATURE, TRAIT_FREQUENCY,
    TRAIT_NAMES,
    SECONDARY_SCALE_MIN,
    SECONDARY_SCALE_MAX,
)

# V1 Delta ranges - single source of truth
# Format: (min_delta, max_delta) inclusive
DELTA_RANGES = {
    "common": (2, 3),
    "uncommon": (3, 5),
    "rare": (4, 6),
    # Epic items use special logic, not raw deltas
    "epic": (0, 0),
}

# Item-specific secondary trait mapping
# Maps template_id -> secondary_trait_name
# This replaces the old INTERDEPENDENCE mapping which was trait-based
ITEM_SECONDARY_TRAIT_MAP = {
    # Salinity items (0-12)
    0: "ph",      # Rust-Flake Calibrator
    1: "ph",      # Brass Drip Coupling
    2: "ph",      # Pickle-Line Tubing Section
    3: "ph",      # Salinity Gauge Cartridge
    4: "temperature",  # Tap-Valve Concentrator
    5: "temperature",  # Dust of Minto Horn
    6: "temperature",  # Pickle-Brine Filter Disk
    7: "temperature",  # Minewater Compression Brick
    8: "frequency",  # Electro-Salt Capacitor
    9: "frequency",  # Outhouse Sludge Tablet
    10: "frequency",  # Cellar Salt-Press Plate
    11: "frequency",  # Iono-Regulation Core
    12: "frequency",  # House-Linen Mineral Strip
    
    # pH items (13-25)
    13: "salinity",  # pH Drip Regulator
    14: "salinity",  # Neutralizing Valve Pellet
    15: "salinity",  # Vinegar-Stone Bite
    16: "salinity",  # Balancing Basin Cartridge
    17: "temperature",  # Metered Dose Basin Syringe
    18: "temperature",  # Unicorn Brew Settling Disc
    19: "temperature",  # Dairy-Ladle pH Paddle
    20: "temperature",  # Guestroom Basin Scale Chip
    21: "frequency",  # Basin-Reactor Flask
    22: "frequency",  # Mineral pH Regulator Shard
    23: "frequency",  # Volatility Modulation Tube
    24: "frequency",  # Deep-Clean Scraper Head
    25: "frequency",  # pH Equilibrium Lance
    
    # Temperature items (26-39)
    26: "salinity",  # Flux-Wick Assembly
    27: "salinity",  # Conduction Scrap Chip
    28: "salinity",  # Stove Coil Topper
    29: "salinity",  # Pantry Thermo-Crank
    30: "salinity",  # Boiler-Runoff Coil Segment
    31: "ph",  # Cellar-Core Capsule
    32: "ph",  # Generator-Chain Flux Loop
    33: "ph",  # Goat-Stall Comfort Rod
    34: "ph",  # Bedframe Coil Support
    35: "frequency",  # Kinetic-Whip Rod
    36: "frequency",  # Charge-Burst Pebble
    37: "frequency",  # Stabilizer Core Block
    38: "frequency",  # Smokehouse Ember Disk
    39: "frequency",  # Flux Convergence Node
    
    # Frequency items (40-53)
    40: "salinity",  # Chime-Plate Resonator
    41: "salinity",  # Buzz-Coil Relay
    42: "salinity",  # Vibe-Spring Coupling
    43: "salinity",  # Broom-Handle Resonance Rod
    44: "salinity",  # Stove-Plate Resonance Cage
    45: "ph",  # Tuning Fork Assembly
    46: "ph",  # Bar-Top Acoustic Rod
    47: "ph",  # Maintenance Rattle Clamp
    48: "ph",  # Door-Hinge Resonance Pin
    49: "temperature",  # Bottling Conveyor Harmonic Wheel
    50: "temperature",  # Lantern-Soot Oscillation Baffle
    51: "temperature",  # Chroma Conduction Core
    52: "temperature",  # Stage-Bell Resonance Drum
    53: "temperature",  # Boiler-Gauge Flux Coupler
    
    # Epic items (54-63) have no secondary trait
}


@dataclass
class ItemTemplate:
    """Template for a catalog item."""
    id: int  # Stable template ID (0..N-1)
    name: str
    rarity: str  # "common", "uncommon", "rare", "epic"
    primary_trait: str  # "salinity", "ph", "temperature", "frequency", or None for epic
    primary_delta: int  # Signed delta value
    secondary_trait: Optional[str]  # Interdependent trait or None
    secondary_delta: int  # Signed delta value
    image_key: Optional[str]  # Image identifier (for future use)
    description: str
    domain: List[str]  # Domain tags (Mining, Tavern, etc.)


# Global catalog - populated on import
CATALOG: List[ItemTemplate] = []
CATALOG_BY_RARITY: Dict[str, List[int]] = {
    "common": [],
    "uncommon": [],
    "rare": [],
    "epic": [],
}


def _parse_canonical_list() -> List[ItemTemplate]:
    """
    Parse the canonical_item_list.md JSON and create ItemTemplate objects.
    
    Returns:
        List of ItemTemplate objects with stable IDs
    """
    catalog_path = Path(__file__).parent / "canonical_item_list.md"
    
    # Read and parse JSON from markdown
    with open(catalog_path, 'r', encoding='utf-8') as f:
        content = f.read()
        # Extract JSON from markdown code block
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        json_str = content[json_start:json_end]
        data = json.loads(json_str)
    
    templates = []
    template_id = 0
    
    # Process trait-based items (salinity, ph, temperature, frequency)
    # Map string trait names to numeric indices for INTERDEPENDENCE lookup
    trait_name_to_index = {
        "salinity": TRAIT_SALINITY,
        "ph": TRAIT_PH,
        "temperature": TRAIT_TEMPERATURE,
        "frequency": TRAIT_FREQUENCY,
    }
    
    for trait_key, trait_name in [("salinity", "salinity"), ("ph", "ph"), 
                                   ("temperature", "temperature"), ("frequency", "frequency")]:
        if trait_key not in data:
            continue
        
        trait_data = data[trait_key]
        trait_index = trait_name_to_index[trait_name]
        
        # Process each rarity level
        for rarity_str in ["common", "uncommon", "rare"]:
            if rarity_str not in trait_data:
                continue
            
            items = trait_data[rarity_str]
            
            # Get delta range for this rarity from explicit DELTA_RANGES
            delta_min, delta_max = DELTA_RANGES.get(rarity_str, (2, 3))
            
            for item_data in items:
                # Assign FIXED, deterministic primary delta magnitude within range
                # Use template_id as seed for consistency - same template always gets same magnitude
                rng = random.Random(template_id)
                primary_delta_magnitude = rng.randint(delta_min, delta_max)
                # Store magnitude (positive); direction will be determined at apply-time based on current vs target
                primary_delta = primary_delta_magnitude
                
                # Get item-specific secondary trait from mapping
                secondary_trait_name = ITEM_SECONDARY_TRAIT_MAP.get(template_id)
                if secondary_trait_name is not None:
                    # Secondary is 15-30% of primary (deterministic based on template_id)
                    # Use a separate seed for secondary scale to ensure determinism
                    scale_rng = random.Random(f"secondary_scale:{template_id}")
                    scale = scale_rng.uniform(SECONDARY_SCALE_MIN, SECONDARY_SCALE_MAX)
                    secondary_delta_magnitude = max(1, int(primary_delta_magnitude * scale))
                    secondary_delta = secondary_delta_magnitude
                else:
                    # No secondary trait for this item (should only happen for epic items)
                    secondary_trait_name = None
                    secondary_delta = 0
                
                template = ItemTemplate(
                    id=template_id,
                    name=item_data["name"],
                    rarity=rarity_str,
                    primary_trait=trait_name,
                    primary_delta=primary_delta,  # Will be signed during generation
                    secondary_trait=secondary_trait_name,
                    secondary_delta=secondary_delta,  # Will be signed during generation
                    image_key=None,  # TODO: Map to image files
                    description=item_data["description"],
                    domain=item_data.get("domain", []),
                )
                
                templates.append(template)
                CATALOG_BY_RARITY[rarity_str].append(template_id)
                template_id += 1
    
    # Process epic items (not tied to a specific trait)
    if "epic" in data:
        epic_items = data["epic"]
        
        for item_data in epic_items:
            template = ItemTemplate(
                id=template_id,
                name=item_data["name"],
                rarity="epic",
                primary_trait=None,  # Epic items don't target specific traits
                primary_delta=0,  # Epic uses special logic
                secondary_trait=None,
                secondary_delta=0,
                image_key=None,
                description=item_data["description"],
                domain=[],  # Epics don't have domain tags
            )
            
            templates.append(template)
            CATALOG_BY_RARITY["epic"].append(template_id)
            template_id += 1
    
    return templates


def _assign_delta_directions(template: ItemTemplate, direction: int) -> ItemTemplate:
    """
    Apply direction to template deltas (for creature-specific generation).
    
    Args:
        template: Template with positive deltas
        direction: +1 toward target, -1 away from target
    
    Returns:
        Template with signed deltas
    """
    return ItemTemplate(
        id=template.id,
        name=template.name,
        rarity=template.rarity,
        primary_trait=template.primary_trait,
        primary_delta=template.primary_delta * direction,
        secondary_trait=template.secondary_trait,
        secondary_delta=template.secondary_delta * direction,
        image_key=template.image_key,
        description=template.description,
        domain=template.domain,
    )


# Initialize catalog on import
CATALOG = _parse_canonical_list()


def get_template(template_id: int) -> Optional[ItemTemplate]:
    """Get template by ID."""
    if 0 <= template_id < len(CATALOG):
        return CATALOG[template_id]
    return None


def get_templates_by_rarity(rarity: str) -> List[ItemTemplate]:
    """Get all templates of a given rarity."""
    template_ids = CATALOG_BY_RARITY.get(rarity, [])
    return [CATALOG[tid] for tid in template_ids]


def get_template_count() -> int:
    """Get total number of templates in catalog."""
    return len(CATALOG)

