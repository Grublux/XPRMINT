"""
Generate catalog.json from Python CATALOG for Solidity deployment.

This script exports the in-memory Python catalog into a JSON file
that can be used by Foundry deployment scripts to populate ItemCatalog.sol.
"""

import json
import sys
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from catalog import CATALOG, get_template

# Trait name to index mapping (matching Solidity)
TRAIT_MAP = {
    "salinity": 0,
    "ph": 1,
    "temperature": 2,
    "frequency": 3,
    None: 255,  # None = 255 for Solidity
}

# Rarity name to index mapping (matching Solidity)
RARITY_MAP = {
    "common": 0,
    "uncommon": 1,
    "rare": 2,
    "epic": 3,
}


def export_catalog_json(output_path: str = None) -> None:
    """
    Export CATALOG to JSON file for Solidity deployment.
    
    Args:
        output_path: Path to output JSON file (default: items/output/catalog.json)
    """
    if output_path is None:
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)
        output_path = str(output_dir / "catalog.json")
    
    catalog_data = []
    
    for template in CATALOG:
        entry = {
            "id": template.id,
            "name": template.name,
            "rarity": RARITY_MAP.get(template.rarity, 0),
            "rarity_name": template.rarity,
            "primary_trait": TRAIT_MAP.get(template.primary_trait, 255),
            "primary_trait_name": template.primary_trait or "none",
            "primary_delta": template.primary_delta,  # Magnitude (positive)
            "secondary_trait": TRAIT_MAP.get(template.secondary_trait, 255),
            "secondary_trait_name": template.secondary_trait or "none",
            "secondary_delta": template.secondary_delta,  # Magnitude (positive)
            "image_key": template.image_key or f"item_{template.id}",  # Default image key
            "description": template.description,
            "domain": template.domain,
        }
        catalog_data.append(entry)
    
    # Write JSON file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)
    
    print(f"Catalog exported to: {output_path}")
    print(f"Total templates: {len(catalog_data)}")
    
    # Print summary by rarity
    by_rarity = {}
    for entry in catalog_data:
        rarity = entry["rarity_name"]
        by_rarity[rarity] = by_rarity.get(rarity, 0) + 1
    
    print("\nTemplates by rarity:")
    for rarity, count in sorted(by_rarity.items()):
        print(f"  {rarity}: {count}")
    
    # Validate the generated catalog
    print("\nValidating generated catalog...")
    try:
        import validate_catalog
        # Re-validate using JSON (since we just wrote it)
        is_valid, errors = validate_catalog.validate_catalog_from_json(output_path)
        
        if not is_valid:
            print(f"\n❌ Validation FAILED: {len(errors)} error(s) found")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more errors")
            raise ValueError("Catalog validation failed")
        
        print("✅ Catalog validation passed: all deltas within expected ranges.")
        
        # Print delta range summary
        print("\nDelta range summary:")
        delta_stats = {}
        for entry in catalog_data:
            rarity = entry["rarity_name"]
            if rarity not in delta_stats:
                delta_stats[rarity] = []
            delta_stats[rarity].append(abs(entry["primary_delta"]))
        
        for rarity in ["common", "uncommon", "rare", "epic"]:
            if rarity in delta_stats and delta_stats[rarity]:
                deltas = delta_stats[rarity]
                print(f"  {rarity}: min={min(deltas)}, max={max(deltas)}, "
                      f"expected={validate_catalog.EXPECTED_DELTA_RANGES[rarity]}")
    except ImportError:
        print("WARNING: validate_catalog.py not found, skipping validation")
    except Exception as e:
        print(f"ERROR during validation: {e}")
        sys.exit(1)


if __name__ == "__main__":
    export_catalog_json()

