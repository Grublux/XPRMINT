#!/usr/bin/env python3
"""
Verify that all catalog entries have corresponding PNG images on disk.

Usage:
    ITEM_IMAGE_DIR=public/items python3 verify_images.py
"""

import json
import os
import sys
from pathlib import Path

# Default image directory
DEFAULT_IMAGE_DIR = "public/items"

# Catalog JSON path
CATALOG_JSON = "docs/stabilization_script/sim/items/output/catalog.json"


def main():
    # Get image directory from environment
    image_dir = os.environ.get("ITEM_IMAGE_DIR", DEFAULT_IMAGE_DIR)
    image_dir = Path(image_dir)
    
    if not image_dir.exists():
        print(f"ERROR: Image directory does not exist: {image_dir}", file=sys.stderr)
        sys.exit(1)
    
    # Load catalog.json
    catalog_path = Path(CATALOG_JSON)
    if not catalog_path.exists():
        print(f"ERROR: Catalog JSON not found: {catalog_path}", file=sys.stderr)
        sys.exit(1)
    
    with open(catalog_path, "r") as f:
        catalog = json.load(f)
    
    if not isinstance(catalog, list):
        print(f"ERROR: Catalog JSON must be an array", file=sys.stderr)
        sys.exit(1)
    
    total = len(catalog)
    missing = []
    invalid = []
    
    # Check each entry
    for entry in catalog:
        template_id = entry.get("id")
        image_key = entry.get("image_key")
        
        if template_id is None or image_key is None:
            invalid.append({
                "id": template_id,
                "image_key": image_key,
                "error": "Missing id or image_key field"
            })
            continue
        
        # Build expected path
        image_path = image_dir / f"{image_key}.png"
        
        # Check if file exists
        if not image_path.exists():
            missing.append({
                "id": template_id,
                "image_key": image_key,
                "path": str(image_path)
            })
            continue
        
        # Check file size
        file_size = image_path.stat().st_size
        if file_size == 0:
            invalid.append({
                "id": template_id,
                "image_key": image_key,
                "path": str(image_path),
                "error": f"File exists but is zero-length ({file_size} bytes)"
            })
    
    # Print results
    if missing:
        print("Missing images:", file=sys.stderr)
        for item in missing:
            print(f"  Template {item['id']}: {item['image_key']} -> {item['path']}", file=sys.stderr)
    
    if invalid:
        print("Invalid entries:", file=sys.stderr)
        for item in invalid:
            error = item.get("error", "Unknown error")
            print(f"  Template {item['id']}: {item['image_key']} - {error}", file=sys.stderr)
    
    # Summary
    ok_count = total - len(missing) - len(invalid)
    if missing or invalid:
        print(f"\nImages OK: {ok_count}/{total}", file=sys.stderr)
        print(f"Images missing: {len(missing)}/{total}", file=sys.stderr)
        if invalid:
            print(f"Images invalid: {len(invalid)}/{total}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"Images OK: {ok_count}/{total} present")
        sys.exit(0)


if __name__ == "__main__":
    main()




