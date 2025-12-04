#!/usr/bin/env python3
"""
Full Item Description Audit – On-Chain Metadata Validator

Fetches and validates metadata for all 64 ERC-1155 item IDs (0–63).
Verifies that every item has non-empty name, description, and image fields.
Confirms that image begins with data:image/png;base64,.
Produces a structured audit table and writes full metadata to JSON.
"""

import os
import json
import base64
import subprocess
import sys
from pathlib import Path

RPC = os.getenv("RPC", "https://apechain.calderachain.xyz/http")
ITEM_V1 = os.getenv("ITEM_V1", "0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e")

if not RPC or not ITEM_V1:
    print("❌ Error: Missing required environment variables RPC or ITEM_V1")
    sys.exit(1)

def run_cast(cmd):
    """Run cast command and return output."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running cast: {e.stderr}")
        raise

def audit_item(item_id):
    """Audit a single item's metadata."""
    print(f"Auditing token ID: {item_id}...", end=" ", flush=True)
    
    # Fetch token URI
    cmd = f'cast call {ITEM_V1} "uri(uint256)(string)" {item_id} --rpc-url {RPC}'
    raw = run_cast(cmd)
    
    # Remove quotes if present
    raw = raw.strip().strip('"')
    
    # Verify base64 data URI prefix
    if not raw.startswith("data:application/json;base64,"):
        raise ValueError(f"Token {item_id} metadata missing base64 data URI prefix")
    
    # Decode base64 JSON
    b64_data = raw.replace("data:application/json;base64,", "")
    json_bytes = base64.b64decode(b64_data)
    decoded = json.loads(json_bytes.decode('utf-8'))
    
    # Extract fields
    name = decoded.get("name", "")
    description = decoded.get("description", "")
    image = decoded.get("image", "")
    
    # Validate required fields
    errors = []
    if not name:
        errors.append("missing name field")
    if not description:
        errors.append("missing description field")
    if not image:
        errors.append("missing image field")
    elif not image.startswith("data:image/png;base64,"):
        errors.append("image field is not a PNG data URI")
    
    if errors:
        raise ValueError(f"Token {item_id}: {', '.join(errors)}")
    
    print("✅")
    
    return {
        "id": item_id,
        "name": name,
        "description": description,
        "description_preview": description[:120] + ("..." if len(description) > 120 else ""),
        "hasImage": True,
        "image_starts_with_png": image.startswith("data:image/png;base64,"),
        "full_metadata": decoded
    }

def main():
    print("=== ITEM DESCRIPTION AUDIT ===")
    print(f"Contract: {ITEM_V1}")
    print(f"RPC: {RPC}")
    print(f"Items to audit: 0-63 (64 total)\n")
    print("-" * 60)
    
    results = []
    full_metadata = []
    errors = []
    
    for item_id in range(64):
        try:
            result = audit_item(item_id)
            results.append({
                "id": result["id"],
                "name": result["name"],
                "description": result["description_preview"],
                "hasImage": result["hasImage"]
            })
            full_metadata.append(result["full_metadata"])
        except Exception as e:
            print(f"❌ {e}")
            errors.append({"id": item_id, "error": str(e)})
            results.append({
                "id": item_id,
                "name": "ERROR",
                "description": str(e),
                "hasImage": False
            })
    
    print("-" * 60)
    print(f"\n✅ Successfully audited: {len(results) - len(errors)}/64")
    if errors:
        print(f"❌ Errors: {len(errors)}/64")
    
    # Write audit summary
    audit_path = Path("descriptions_audit.json")
    with open(audit_path, "w") as f:
        json.dump(results, f, indent=2)
    
    # Write full metadata
    full_metadata_path = Path("descriptions_audit_full.json")
    with open(full_metadata_path, "w") as f:
        json.dump(full_metadata, f, indent=2)
    
    # Print summary table
    print("\n=== AUDIT SUMMARY TABLE ===")
    print(f"{'ID':<4} {'Name':<40} {'Description Preview':<50}")
    print("-" * 100)
    for r in results:
        name = r["name"][:38] + (".." if len(r["name"]) > 38 else "")
        desc = r["description"][:48] + (".." if len(r["description"]) > 48 else "")
        status = "✅" if r["hasImage"] else "❌"
        print(f"{r['id']:<4} {name:<40} {desc:<50} {status}")
    
    print(f"\n📄 Audit summary written to: {audit_path}")
    print(f"📄 Full metadata written to: {full_metadata_path}")
    
    if errors:
        print(f"\n⚠️  {len(errors)} items had errors:")
        for err in errors:
            print(f"   Item {err['id']}: {err['error']}")
        sys.exit(1)
    else:
        print("\n🎉 All items passed audit!")

if __name__ == "__main__":
    main()




