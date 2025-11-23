"""
Generate JSON fixtures for Foundry golden tests.

This script creates deterministic item streams and epic examples
that can be used to verify Solidity implementation matches Python.
"""

import json
import sys
import os
from typing import List, Dict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from item_core import generate_item, SimItem, encode_item_id
from apply_item import CreatureTraitState, apply_item_to_creature


def generate_item_stream_fixture(day_index: int, num_items: int, creature_id: int = 1) -> List[Dict]:
    """
    Generate a stream of items for a given day.
    
    Args:
        day_index: Day to generate items for
        num_items: Number of items to generate
        creature_id: Creature ID for seed derivation
    
    Returns:
        List of item dictionaries
    """
    # Use a fixed global entropy for reproducibility (matches Solidity test entropy)
    # This should match the entropy used in Foundry tests
    global_entropy = b'XPRMINT_GLOBAL_ENTROPY_V1' + b'\x00' * (32 - 26)  # Pad to 32 bytes
    
    items = []
    for i in range(num_items):
        # Match Solidity: dayIndex = day * 1000 + i for multiple items per day
        day_index_for_item = day_index * 1000 + i
        item = generate_item(creature_id, day_index_for_item, global_entropy)
        
        # Get template data if available
        template_data = None
        if item.template_id is not None:
            try:
                from catalog import get_template
                template = get_template(item.template_id)
                if template:
                    template_data = {
                        "id": template.id,
                        "name": template.name,
                        "description": template.description,
                        "domain": template.domain,
                    }
            except ImportError:
                pass
        
        item_dict = {
            "day": day_index,
            "item_index": i,
            "day_index_for_item": day_index_for_item,
            "creature_id": creature_id,
            "template_id": item.template_id,
            "item": {
                "rarity": item.rarity,
                "primary_trait": item.primary_trait,
                "primary_delta": item.primary_delta,
                "secondary_trait": item.secondary_trait,
                "secondary_delta": item.secondary_delta,
                "epic_seed": item.epic_seed
            },
            "template": template_data,
            "item_id": encode_item_id(item, creature_id, day_index_for_item, global_entropy)
        }
        items.append(item_dict)
    
    return items


def generate_epic_examples() -> List[Dict]:
    """
    Generate epic item application examples with before/after states.
    """
    examples = []
    global_entropy = b'XPRMINT_GLOBAL_ENTROPY_V1' + b'\x00' * (32 - 26)
    
    # Example 1: All traits far from target
    state1 = CreatureTraitState(
        targets={"salinity": 50, "ph": 30, "temperature": 60, "frequency": 40},
        current={"salinity": 65, "ph": 20, "temperature": 75, "frequency": 30},
        locked={"salinity": False, "ph": False, "temperature": False, "frequency": False}
    )
    
    # Generate a real epic item (day 7+)
    creature_id = 1
    day_index = 7000  # Day 7, item 0
    epic_item = None
    for i in range(100):  # Try up to 100 times to get an epic
        item = generate_item(creature_id, day_index + i, global_entropy)
        if item.rarity == "epic":
            epic_item = item
            break
    
    if not epic_item:
        # Fallback: create epic manually if generation fails
        epic_item = SimItem(
            rarity="epic",
            primary_trait=None,
            primary_delta=0,
            secondary_trait=None,
            secondary_delta=0,
            epic_seed=12345
        )
    
    before = {
        "salinity": state1.current["salinity"],
        "ph": state1.current["ph"],
        "temperature": state1.current["temperature"],
        "frequency": state1.current["frequency"]
    }
    
    apply_item_to_creature(state1, epic_item)
    
    after = {
        "salinity": state1.current["salinity"],
        "ph": state1.current["ph"],
        "temperature": state1.current["temperature"],
        "frequency": state1.current["frequency"]
    }
    
    examples.append({
        "before": before,
        "item": {
            "rarity": epic_item.rarity,
            "epic_seed": epic_item.epic_seed
        },
        "after": after
    })
    
    # Example 2: One trait close, others far
    state2 = CreatureTraitState(
        targets={"salinity": 50, "ph": 30, "temperature": 60, "frequency": 40},
        current={"salinity": 52, "ph": 15, "temperature": 80, "frequency": 25},
        locked={"salinity": False, "ph": False, "temperature": False, "frequency": False}
    )
    
    # Generate another epic
    epic_item2 = None
    for i in range(100):
        item = generate_item(creature_id, day_index + 100 + i, global_entropy)
        if item.rarity == "epic":
            epic_item2 = item
            break
    
    if not epic_item2:
        epic_item2 = SimItem(
            rarity="epic",
            primary_trait=None,
            primary_delta=0,
            secondary_trait=None,
            secondary_delta=0,
            epic_seed=54321
        )
    
    before2 = {
        "salinity": state2.current["salinity"],
        "ph": state2.current["ph"],
        "temperature": state2.current["temperature"],
        "frequency": state2.current["frequency"]
    }
    
    apply_item_to_creature(state2, epic_item2)
    
    after2 = {
        "salinity": state2.current["salinity"],
        "ph": state2.current["ph"],
        "temperature": state2.current["temperature"],
        "frequency": state2.current["frequency"]
    }
    
    examples.append({
        "before": before2,
        "item": {
            "rarity": epic_item2.rarity,
            "epic_seed": epic_item2.epic_seed
        },
        "after": after2
    })
    
    # Example 3: Linear item (C/U/R) for comparison
    state3 = CreatureTraitState(
        targets={"salinity": 50, "ph": 30, "temperature": 60, "frequency": 40},
        current={"salinity": 55, "ph": 28, "temperature": 65, "frequency": 38},
        locked={"salinity": False, "ph": False, "temperature": False, "frequency": False}
    )
    
    linear_item = generate_item(creature_id, 1000, global_entropy)  # Day 1, item 0
    # Ensure it's not epic
    while linear_item.rarity == "epic":
        linear_item = generate_item(creature_id, 1000 + len(examples) * 10, global_entropy)
    
    before3 = {
        "salinity": state3.current["salinity"],
        "ph": state3.current["ph"],
        "temperature": state3.current["temperature"],
        "frequency": state3.current["frequency"]
    }
    
    apply_item_to_creature(state3, linear_item)
    
    after3 = {
        "salinity": state3.current["salinity"],
        "ph": state3.current["ph"],
        "temperature": state3.current["temperature"],
        "frequency": state3.current["frequency"]
    }
    
    examples.append({
        "before": before3,
        "item": {
            "rarity": linear_item.rarity,
            "primary_trait": linear_item.primary_trait,
            "primary_delta": linear_item.primary_delta,
            "secondary_trait": linear_item.secondary_trait,
            "secondary_delta": linear_item.secondary_delta,
            "epic_seed": None
        },
        "after": after3
    })
    
    return examples


def main():
    """Generate all fixture files."""
    output_dir = "../output/fixtures"
    
    # Generate day 1 item stream
    day1_items = generate_item_stream_fixture(1, 10)
    with open(f"{output_dir}/item_stream_day_1.json", "w") as f:
        json.dump(day1_items, f, indent=2)
    
    # Generate day 7 item stream (epics possible)
    day7_items = generate_item_stream_fixture(7, 20)
    with open(f"{output_dir}/item_stream_day_7.json", "w") as f:
        json.dump(day7_items, f, indent=2)
    
    # Generate epic examples
    epic_examples = generate_epic_examples()
    with open(f"{output_dir}/epic_examples.json", "w") as f:
        json.dump(epic_examples, f, indent=2)
    
    print("Fixtures generated successfully!")


if __name__ == "__main__":
    main()

