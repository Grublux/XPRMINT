# CRAFTED Kernel – Canonical Spec

This file is the **source of truth** for the Crafted collection and the MasterCrafterV1 engine on ApeChain. Do **not** contradict this document in future work. Only extend it.

## Network

- Chain: **ApeChain**

## Core Tokens

- **NGT**: `0x72CddB64A72176B442bdfD9C8Bb7968E652d8D1a`
- **NPC 721** (seat / crafter gating): `0xFA1c20E0d4277b1e0b289DfFadb5Bd92Fb8486aA`

## Limit Break Transfer Validator

- Validator: `0x721C008fdff27BF06E7E123956E2Fe03B63342e3`
- Integrated via ERC721C-style transfer validation.
- Collection ruleset is configured via `setRulesetOfCollection(address collection, uint8 rulesetId, address customRuleset, uint8 globalOptions, uint16 rulesetOptions)`.

## Crafted Collection

- **Collection Name**: `Crafted`
- **Symbol**: `CRAFT`
- **Type**: `ERC721C` (Limit Break, enforced royalties via validator)

### Positions NFT (CraftedV1Positions)

- Contract source: `contracts/crafted/CraftedV1Positions.sol`
- Deployed as a **proxy** (TransparentUpgradeableProxy).
- Name: `Crafted`
- Symbol: `CRAFT`
- Default royalty: **6.9%** (collection-level, enforced by validator).
- Transfer validation: wired to Limit Break validator.

### Engine (MasterCrafterV1)

- Contract source: `contracts/crafted/MasterCrafterV1.sol`
- Pattern: **UUPS upgradeable**.
- Responsibilities:
  - Define and manage **recipes** (COIN, RELIC, ARTIFACT, TOOL, etc.).
  - Handle **NGT locking** and optional COAL burning.
  - Handle **crafting** (mint positions) and **destroying** (burn positions, return NGT).
  - Enforce **NPC gating** for crafting (must own an NPC seat).
  - Track **NPC stats** and **derived XP**.
  - Resolve **royalty receivers** (NPC seat owner) for positions.

## Recipe #1 – Genesis Coin

- **ID**: `1`
- **Class**: `COIN`
- **URI**: `https://www.xprmint.com/coins/coin1a.json`
- **Input token**: `NGT`
- **Input per unit**: `1000 NGT`
- **COAL required**: `false` (all COAL fields zero)
- **Craft fee bps**: `0`
- **Destroy fee bps**: `1000` (10%)
- **Lock duration**: `60 seconds` (env-driven on deploy via `LOCK_DURATION_SECONDS`)

### Behavior for Recipe #1

- To **craft**:
  - Caller must own an NPC in the configured NPC 721 contract (this is the "seat").
  - 1000 NGT is transferred from the caller and locked in the position.
  - A Crafted position NFT is minted to the caller.
  - NPC stats (positions forged, total NGT locked, etc.) are updated.

- To **destroy**:
  - Only the **position owner** (bearer) can destroy.
  - Lock duration must have fully elapsed.
  - The position NFT is burned.
  - The locked NGT is split:
    - **10%** → NPC seat owner (destroy fee).
    - **90%** → position bearer.
  - NPC stats and XP are updated.

### NPC XP (Conceptual)

- MasterCrafterV1 tracks per NPC:
  - positionsForged
  - positionsDestroyed
  - totalNGTLocked
  - totalNGTFeeEarned
  - totalCoalBurned (for future recipes)
  - lastForgeAt

- A view function returns derived XP. The exact formula can be changed via upgrade; for now it is a deterministic function of the above metrics.

## Metadata Schema (External View)

When serving metadata (via tokenURI or an HTTP API), **for now** we care about these fields:

- Visible on marketplaces (e.g., Magic Eden):
  - `Forge` (string) — e.g. `NGMI Genesis Forge`
  - `Crafter` (string) — NPC name or player-defined crafter alias
  - `Item Class` (string) — e.g. `Coin`
  - `NGT Burned` (number) — e.g. `1000`

- Internal-only / for our own UI:
  - `Recipe ID`
  - `NPC Seat Token ID`
  - `XP`
  - `Total NGT Locked`
  - `Total NGT Fee Earned`
  - `Total Coal Burned`
  - `positionsForged`
  - `positionsDestroyed`
  - `firstForgeAt`
  - `lastForgeAt`

### Default Metadata Template for Recipe #1

```json
{
  "name": "Crafted #<tokenId>",
  "description": "A forged NGT Coin crafted via the MasterCrafter on ApeChain.",
  "image": "https://www.xprmint.com/coins/coin1a.png",
  "attributes": [
    { "trait_type": "Forge", "value": "NGMI Genesis Forge" },
    { "trait_type": "Crafter", "value": "Unassigned" },
    { "trait_type": "Item Class", "value": "Coin" },
    { "trait_type": "NGT Burned", "value": 1000 }
  ]
}
```

## Foundry Configuration (Canonical)

- `via_ir = false` (do not flip this on for crafting / forged / crafted contracts).
- Remappings (relevant pieces):

```toml
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
@openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/
creator-token-standards/=lib/creator-token-standards/src/
creator-token-standards/erc721c/=lib/creator-token-standards/src/erc721c/
creator-token-standards/token/=lib/creator-token-standards/src/token/
creator-token-standards/programmable-royalties/=lib/creator-token-standards/src/programmable-royalties/
creator-token-standards/access/=lib/creator-token-standards/src/access/
creator-token-standards/@openzeppelin/contracts/=lib/creator-token-standards/lib/openzeppelin-contracts/contracts/
```

## Rules

- Do **NOT** change:
  - NGT address
  - NPC 721 address
  - Validator address
  - Collection name `Crafted` and symbol `CRAFT`
  - Basic behavior of Recipe #1 (1000 NGT, 10% destroy fee, NPC gating).
  - General meaning of NPC stats and XP.

- You **may** extend:
  - New recipes (different NGT amounts, COAL inputs, other items).
  - Metadata richness (more attributes).
  - Forge name & crafter name registries.
  - Frontend APIs and dashboards.

This document should be updated **only** when the on-chain behavior or core design changes.

