# ItemCatalog Monitoring & Integrity Verification

This document describes how to monitor and verify the integrity of the on-chain `ItemCatalog` against the canonical `catalog.json` source of truth.

## Overview

The monitoring system ensures that:
1. All templates from `catalog.json` are present on-chain
2. Template data (rarity, traits, deltas, names, descriptions) matches between JSON and on-chain
3. No unauthorized modifications have occurred
4. Catalog hash matches between source and on-chain

## Monitoring Script

### Python Implementation

Create a script `scripts/monitor_catalog.py`:

```python
#!/usr/bin/env python3
"""
Monitor ItemCatalog integrity against catalog.json.

Usage:
    python scripts/monitor_catalog.py --rpc-url https://apechain.xyz
    python scripts/monitor_catalog.py --rpc-url https://apechain.xyz --catalog-address 0x...
"""

import json
import sys
import argparse
from pathlib import Path
from web3 import Web3
from eth_abi import encode
from eth_utils import keccak

# ItemCatalog ABI (minimal)
CATALOG_ABI = [
    {
        "inputs": [{"name": "templateId", "type": "uint256"}],
        "name": "getTemplate",
        "outputs": [
            {
                "components": [
                    {"name": "rarity", "type": "uint8"},
                    {"name": "primaryTrait", "type": "uint8"},
                    {"name": "primaryDelta", "type": "int16"},
                    {"name": "secondaryTrait", "type": "uint8"},
                    {"name": "secondaryDelta", "type": "int16"},
                    {"name": "imagePtr", "type": "address"},
                    {"name": "name", "type": "string"},
                    {"name": "description", "type": "string"},
                ],
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "templateCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# Trait mappings
TRAIT_NAMES = ["Salinity", "pH", "Temperature", "Frequency", "None"]
RARITY_NAMES = ["Common", "Uncommon", "Rare", "Epic"]


def load_catalog_json(path: str) -> list:
    """Load catalog.json file."""
    with open(path, "r") as f:
        return json.load(f)


def compute_catalog_hash(entries: list) -> bytes:
    """
    Compute deterministic hash of catalog entries.
    
    Hash is computed as keccak256 of concatenated:
    - id (uint256)
    - rarity (uint8)
    - primaryTrait (uint8)
    - primaryDelta (int16)
    - secondaryTrait (uint8)
    - secondaryDelta (int16)
    - name (string)
    - description (string)
    """
    encoded = b""
    for entry in sorted(entries, key=lambda x: x["id"]):
        encoded += encode(
            ["uint256", "uint8", "uint8", "int16", "uint8", "int16", "string", "string"],
            [
                entry["id"],
                entry["rarity"],
                entry["primary_trait"],
                entry["primary_delta"],
                entry["secondary_trait"],
                entry["secondary_delta"],
                entry["name"],
                entry["description"],
            ],
        )
    return keccak(encoded)


def verify_template(
    w3: Web3, catalog_address: str, entry: dict, template_id: int
) -> tuple[bool, list[str]]:
    """
    Verify a single template against on-chain data.
    
    Returns:
        (is_valid, list_of_errors)
    """
    catalog = w3.eth.contract(address=catalog_address, abi=CATALOG_ABI)
    
    try:
        template = catalog.functions.getTemplate(template_id).call()
    except Exception as e:
        return False, [f"Failed to fetch template: {e}"]
    
    errors = []
    
    # Compare fields
    if template[0] != entry["rarity"]:
        errors.append(
            f"Rarity mismatch: JSON={RARITY_NAMES[entry['rarity']]}, "
            f"on-chain={RARITY_NAMES[template[0]]}"
        )
    
    if template[1] != entry["primary_trait"]:
        errors.append(
            f"Primary trait mismatch: JSON={TRAIT_NAMES[entry['primary_trait']]}, "
            f"on-chain={TRAIT_NAMES[template[1]]}"
        )
    
    if template[2] != entry["primary_delta"]:
        errors.append(
            f"Primary delta mismatch: JSON={entry['primary_delta']}, "
            f"on-chain={template[2]}"
        )
    
    if template[3] != entry["secondary_trait"]:
        errors.append(
            f"Secondary trait mismatch: JSON={TRAIT_NAMES[entry['secondary_trait']]}, "
            f"on-chain={TRAIT_NAMES[template[3]]}"
        )
    
    if template[4] != entry["secondary_delta"]:
        errors.append(
            f"Secondary delta mismatch: JSON={entry['secondary_delta']}, "
            f"on-chain={template[4]}"
        )
    
    if template[6] != entry["name"]:
        errors.append(f"Name mismatch: JSON='{entry['name']}', on-chain='{template[6]}'")
    
    if template[7] != entry["description"]:
        errors.append(
            f"Description mismatch: JSON='{entry['description'][:50]}...', "
            f"on-chain='{template[7][:50]}...'"
        )
    
    return len(errors) == 0, errors


def main():
    parser = argparse.ArgumentParser(description="Monitor ItemCatalog integrity")
    parser.add_argument(
        "--rpc-url",
        required=True,
        help="RPC URL (e.g., https://apechain.xyz)",
    )
    parser.add_argument(
        "--catalog-address",
        required=True,
        help="ItemCatalog contract address",
    )
    parser.add_argument(
        "--catalog-json",
        default="docs/stabilization_script/sim/items/output/catalog.json",
        help="Path to catalog.json",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Verbose output"
    )
    
    args = parser.parse_args()
    
    # Connect to chain
    w3 = Web3(Web3.HTTPProvider(args.rpc_url))
    if not w3.is_connected():
        print("ERROR: Failed to connect to RPC")
        sys.exit(1)
    
    print(f"Connected to {args.rpc_url}")
    print(f"Block number: {w3.eth.block_number}")
    
    # Load catalog.json
    catalog_json = load_catalog_json(args.catalog_json)
    print(f"Loaded {len(catalog_json)} templates from catalog.json")
    
    # Check on-chain count
    catalog = w3.eth.contract(address=args.catalog_address, abi=CATALOG_ABI)
    try:
        on_chain_count = catalog.functions.templateCount().call()
        print(f"On-chain template count: {on_chain_count}")
        
        if on_chain_count != len(catalog_json):
            print(
                f"WARNING: Count mismatch! JSON={len(catalog_json)}, "
                f"on-chain={on_chain_count}"
            )
    except Exception as e:
        print(f"WARNING: Could not fetch template count: {e}")
        on_chain_count = None
    
    # Compute hash of JSON catalog
    json_hash = compute_catalog_hash(catalog_json)
    print(f"\nCatalog JSON hash: {json_hash.hex()}")
    
    # Verify each template
    print("\nVerifying templates...")
    errors_found = 0
    verified_count = 0
    
    for entry in catalog_json:
        template_id = entry["id"]
        is_valid, template_errors = verify_template(
            w3, args.catalog_address, entry, template_id
        )
        
        if is_valid:
            verified_count += 1
            if args.verbose:
                print(f"✓ Template {template_id}: {entry['name']}")
        else:
            errors_found += 1
            print(f"\n✗ Template {template_id}: {entry['name']}")
            for error in template_errors:
                print(f"  - {error}")
    
    # Summary
    print("\n" + "=" * 60)
    print("Verification Summary")
    print("=" * 60)
    print(f"Total templates: {len(catalog_json)}")
    print(f"Verified: {verified_count}")
    print(f"Errors: {errors_found}")
    
    if errors_found > 0:
        print("\n⚠️  INTEGRITY CHECK FAILED")
        print("Investigate discrepancies immediately!")
        sys.exit(1)
    else:
        print("\n✓ All templates verified successfully")
        print(f"Catalog hash: {json_hash.hex()}")
        sys.exit(0)


if __name__ == "__main__":
    main()
```

### TypeScript Implementation

Alternatively, create `scripts/monitor-catalog.ts`:

```typescript
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const CATALOG_ABI = [
  "function getTemplate(uint256) view returns (tuple(uint8 rarity, uint8 primaryTrait, int16 primaryDelta, uint8 secondaryTrait, int16 secondaryDelta, address imagePtr, string name, string description))",
  "function templateCount() view returns (uint256)",
];

interface CatalogEntry {
  id: number;
  name: string;
  rarity: number;
  primary_trait: number;
  primary_delta: number;
  secondary_trait: number;
  secondary_delta: number;
  description: string;
}

async function monitorCatalog(
  rpcUrl: string,
  catalogAddress: string,
  catalogJsonPath: string
) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const catalog = new ethers.Contract(catalogAddress, CATALOG_ABI, provider);

  // Load catalog.json
  const catalogJson: CatalogEntry[] = JSON.parse(
    fs.readFileSync(catalogJsonPath, "utf-8")
  );

  console.log(`Loaded ${catalogJson.length} templates from catalog.json`);

  // Check on-chain count
  const onChainCount = await catalog.templateCount();
  console.log(`On-chain template count: ${onChainCount}`);

  if (onChainCount !== BigInt(catalogJson.length)) {
    console.warn(
      `WARNING: Count mismatch! JSON=${catalogJson.length}, on-chain=${onChainCount}`
    );
  }

  // Verify each template
  let errors = 0;
  for (const entry of catalogJson) {
    const template = await catalog.getTemplate(entry.id);

    const mismatches: string[] = [];
    if (template.rarity !== entry.rarity) {
      mismatches.push(`rarity: ${template.rarity} !== ${entry.rarity}`);
    }
    if (template.primaryTrait !== entry.primary_trait) {
      mismatches.push(
        `primaryTrait: ${template.primaryTrait} !== ${entry.primary_trait}`
      );
    }
    if (template.primaryDelta !== entry.primary_delta) {
      mismatches.push(
        `primaryDelta: ${template.primaryDelta} !== ${entry.primary_delta}`
      );
    }
    if (template.secondaryTrait !== entry.secondary_trait) {
      mismatches.push(
        `secondaryTrait: ${template.secondaryTrait} !== ${entry.secondary_trait}`
      );
    }
    if (template.secondaryDelta !== entry.secondary_delta) {
      mismatches.push(
        `secondaryDelta: ${template.secondaryDelta} !== ${entry.secondary_delta}`
      );
    }
    if (template.name !== entry.name) {
      mismatches.push(`name: '${template.name}' !== '${entry.name}'`);
    }
    if (template.description !== entry.description) {
      mismatches.push(`description mismatch`);
    }

    if (mismatches.length > 0) {
      errors++;
      console.error(`✗ Template ${entry.id} (${entry.name}):`);
      mismatches.forEach((m) => console.error(`  - ${m}`));
    } else {
      console.log(`✓ Template ${entry.id}: ${entry.name}`);
    }
  }

  console.log(`\nVerification complete: ${errors} errors found`);
  process.exit(errors > 0 ? 1 : 0);
}

// CLI usage
const rpcUrl = process.env.RPC_URL || "https://apechain.xyz";
const catalogAddress = process.argv[2];
const catalogJsonPath =
  process.argv[3] ||
  "docs/stabilization_script/sim/items/output/catalog.json";

if (!catalogAddress) {
  console.error("Usage: ts-node monitor-catalog.ts <catalog-address> [catalog-json-path]");
  process.exit(1);
}

monitorCatalog(rpcUrl, catalogAddress, catalogJsonPath).catch(console.error);
```

## Usage Examples

### Python Script

```bash
# Monitor against ApeChain mainnet
python scripts/monitor_catalog.py \
  --rpc-url https://apechain.xyz \
  --catalog-address 0x1234567890123456789012345678901234567890

# Verbose output
python scripts/monitor_catalog.py \
  --rpc-url https://apechain.xyz \
  --catalog-address 0x1234567890123456789012345678901234567890 \
  --verbose
```

### TypeScript Script

```bash
# Set RPC URL
export RPC_URL=https://apechain.xyz

# Run monitoring
ts-node scripts/monitor-catalog.ts \
  0x1234567890123456789012345678901234567890 \
  docs/stabilization_script/sim/items/output/catalog.json
```

## Automated Monitoring

### Cron Job

Set up a cron job to run monitoring daily:

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/project && python scripts/monitor_catalog.py --rpc-url https://apechain.xyz --catalog-address 0x... >> logs/catalog-monitor.log 2>&1
```

### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Verify ItemCatalog Integrity
  run: |
    python scripts/monitor_catalog.py \
      --rpc-url ${{ secrets.APECHAIN_RPC_URL }} \
      --catalog-address ${{ secrets.ITEM_CATALOG_ADDRESS }}
```

## Red Flags

Any of the following should trigger immediate investigation:

1. **Count Mismatch**: On-chain template count doesn't match JSON
2. **Field Mismatches**: Any template field differs between JSON and on-chain
3. **Missing Templates**: Template ID exists in JSON but not on-chain
4. **Hash Mismatch**: Catalog hash computed from JSON doesn't match on-chain hash (if implemented)

## Investigation Steps

If discrepancies are found:

1. **Check Recent Transactions**: Review recent `addTemplate` calls to ItemCatalog
2. **Verify Upgrade**: If catalog was upgraded, ensure new schema matches expectations
3. **Compare Block Numbers**: Ensure monitoring script is reading from the correct block
4. **Review Access Control**: Verify only authorized addresses can call `addTemplate`
5. **Check for Reentrancy**: Ensure no unexpected state changes occurred

## Hash-Based Verification (Future Enhancement)

For stronger integrity guarantees, implement a hash-based verification:

1. Compute `keccak256` of all template data concatenated in order
2. Store this hash in ItemCatalog (via a view function or separate storage)
3. Compare on-chain hash with JSON hash during monitoring

This provides a single value to verify entire catalog integrity without checking each field individually.


