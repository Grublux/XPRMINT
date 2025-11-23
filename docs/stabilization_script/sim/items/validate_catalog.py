"""
Validate catalog delta ranges against v1 specifications.

This script ensures all item templates have deltas within the expected ranges:
- Common: 2-3
- Uncommon: 3-5
- Rare: 4-6
- Epic: 0 (both primary and secondary)
"""

import sys
import os
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Try to load from catalog.py first (source of truth)
try:
    from catalog import CATALOG, DELTA_RANGES
    USE_CATALOG_PY = True
except ImportError:
    USE_CATALOG_PY = False

# V1 Delta ranges - must match catalog.py
EXPECTED_DELTA_RANGES = {
    "common": (2, 3),
    "uncommon": (3, 5),
    "rare": (4, 6),
    "epic": (0, 0),
}


def validate_template(template, template_id: int) -> list[str]:
    """
    Validate a single template against delta range rules.
    
    Args:
        template: ItemTemplate object or dict from JSON
        template_id: Template ID for error messages
    
    Returns:
        List of error messages (empty if valid)
    """
    errors = []
    
    # Extract fields based on source
    if hasattr(template, 'rarity'):
        # ItemTemplate object
        rarity_name = template.rarity
        primary_delta = template.primary_delta
        secondary_delta = template.secondary_delta
        secondary_trait = template.secondary_trait
        name = template.name
    else:
        # Dict from JSON
        rarity_name = template.get("rarity_name", template.get("rarity", ""))
        primary_delta = template.get("primary_delta", 0)
        secondary_delta = template.get("secondary_delta", 0)
        secondary_trait = template.get("secondary_trait", template.get("secondary_trait_name", None))
        name = template.get("name", f"Template {template_id}")
    
    # Get expected range
    if rarity_name not in EXPECTED_DELTA_RANGES:
        errors.append(
            f"Template {template_id} ({name}): Unknown rarity '{rarity_name}'"
        )
        return errors
    
    min_delta, max_delta = EXPECTED_DELTA_RANGES[rarity_name]
    
    # Validate primary delta
    if rarity_name == "epic":
        if primary_delta != 0:
            errors.append(
                f"Template {template_id} ({name}): Epic items must have primary_delta=0, got {primary_delta}"
            )
        if secondary_delta != 0:
            errors.append(
                f"Template {template_id} ({name}): Epic items must have secondary_delta=0, got {secondary_delta}"
            )
        # Epic items should have no secondary trait (None or 255 or "none")
        if secondary_trait is not None and secondary_trait != 255 and secondary_trait != "none":
            errors.append(
                f"Template {template_id} ({name}): Epic items must have secondary_trait=None/255/none, got {secondary_trait}"
            )
    else:
        # For non-epic, check magnitude (should be positive in catalog)
        primary_magnitude = abs(primary_delta)
        if not (min_delta <= primary_magnitude <= max_delta):
            errors.append(
                f"Template {template_id} ({name}): {rarity_name} items must have primary_delta "
                f"magnitude in range [{min_delta}, {max_delta}], got {primary_magnitude}"
            )
        
        # Non-epic items MUST have a secondary trait (not None, not 255, not "none")
        if secondary_trait is None or secondary_trait == 255 or secondary_trait == "none":
            errors.append(
                f"Template {template_id} ({name}): {rarity_name} items must have a secondary_trait, "
                f"got {secondary_trait}"
            )
        
        # Non-epic items MUST have secondary_delta > 0
        if secondary_delta == 0:
            errors.append(
                f"Template {template_id} ({name}): {rarity_name} items must have secondary_delta > 0, "
                f"got {secondary_delta}"
            )
        
        # Secondary delta should be 15-30% of primary (approximately)
        if secondary_delta != 0:
            secondary_magnitude = abs(secondary_delta)
            primary_magnitude = abs(primary_delta)
            
            # Check that secondary is at least 1
            if secondary_magnitude < 1:
                errors.append(
                    f"Template {template_id} ({name}): secondary_delta magnitude {secondary_magnitude} "
                    f"must be at least 1"
                )
            
            # Check that secondary is within 15-30% of primary (with tolerance for small primaries)
            min_secondary_ratio = primary_magnitude * 0.15
            max_secondary_ratio = primary_magnitude * 0.30
            
            # For small primary deltas, 30% might be < 1, so we allow at least 1
            min_secondary = max(1, int(min_secondary_ratio))
            max_secondary = max(1, int(max_secondary_ratio))
            
            # For very small primaries (2-3), allow secondary=1 even if it's > 30%
            # This is acceptable because we can't have fractional deltas
            if primary_magnitude <= 3:
                # For primary 2-3, allow secondary 1 (which is 33-50% of primary, acceptable)
                if secondary_magnitude != 1:
                    errors.append(
                        f"Template {template_id} ({name}): For small primary_delta ({primary_magnitude}), "
                        f"secondary_delta should be 1, got {secondary_magnitude}"
                    )
            else:
                # For larger primaries, enforce 15-30% range
                if secondary_magnitude < min_secondary or secondary_magnitude > max_secondary:
                    errors.append(
                        f"Template {template_id} ({name}): secondary_delta magnitude {secondary_magnitude} "
                        f"should be 15-30% of primary ({primary_magnitude}), expected range [{min_secondary}, {max_secondary}]"
                    )
    
    return errors


def validate_catalog_from_py() -> tuple[bool, list[str]]:
    """Validate catalog loaded from catalog.py."""
    all_errors = []
    
    for template in CATALOG:
        errors = validate_template(template, template.id)
        all_errors.extend(errors)
    
    return len(all_errors) == 0, all_errors


def validate_catalog_from_json(json_path: str) -> tuple[bool, list[str]]:
    """Validate catalog loaded from JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        catalog_data = json.load(f)
    
    all_errors = []
    
    for entry in catalog_data:
        template_id = entry.get("id", -1)
        errors = validate_template(entry, template_id)
        all_errors.extend(errors)
    
    return len(all_errors) == 0, all_errors


def print_summary(catalog_data: list) -> None:
    """Print summary statistics."""
    by_rarity = {}
    delta_stats = {}
    
    for entry in catalog_data:
        if hasattr(entry, 'rarity'):
            rarity = entry.rarity
            primary_delta = abs(entry.primary_delta)
        else:
            rarity = entry.get("rarity_name", entry.get("rarity", ""))
            primary_delta = abs(entry.get("primary_delta", 0))
        
        if rarity not in by_rarity:
            by_rarity[rarity] = []
            delta_stats[rarity] = []
        
        by_rarity[rarity].append(entry)
        delta_stats[rarity].append(primary_delta)
    
    print("\nCatalog Summary:")
    print("=" * 60)
    for rarity in ["common", "uncommon", "rare", "epic"]:
        if rarity in by_rarity:
            count = len(by_rarity[rarity])
            deltas = delta_stats[rarity]
            if deltas:
                min_delta = min(deltas)
                max_delta = max(deltas)
                print(f"{rarity.capitalize():10} {count:3} templates | "
                      f"primary_delta range: [{min_delta}, {max_delta}]")
            else:
                print(f"{rarity.capitalize():10} {count:3} templates")
    
    print("=" * 60)


def main():
    """Main validation function."""
    # Try to validate from catalog.py first
    if USE_CATALOG_PY:
        print("Validating catalog from catalog.py (source of truth)...")
        is_valid, errors = validate_catalog_from_py()
        
        # Convert to dict format for summary
        catalog_data = [
            {
                "id": t.id,
                "rarity_name": t.rarity,
                "primary_delta": t.primary_delta,
                "secondary_delta": t.secondary_delta,
                "name": t.name,
            }
            for t in CATALOG
        ]
    else:
        # Fall back to JSON
        json_path = Path(__file__).parent / "output" / "catalog.json"
        if not json_path.exists():
            print(f"ERROR: catalog.json not found at {json_path}")
            print("Please run generate_catalog_json.py first")
            sys.exit(1)
        
        print(f"Validating catalog from {json_path}...")
        is_valid, errors = validate_catalog_from_json(str(json_path))
        
        with open(json_path, 'r', encoding='utf-8') as f:
            catalog_data = json.load(f)
    
    # Print summary
    print_summary(catalog_data)
    
    # Report results
    if errors:
        print(f"\n❌ Validation FAILED: {len(errors)} error(s) found\n")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    else:
        print("\n✅ Catalog validation passed: all deltas within expected ranges.")
        sys.exit(0)


if __name__ == "__main__":
    main()

