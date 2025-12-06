# Crafted Metadata – Architecture & Vercel Projects

## TL;DR

- **Metadata for Crafted V1 is now served by a dedicated, private Vercel project** based on the **`xprmint-metadata`** repo.
- The endpoint is live and verified at:
  - `https://xprmint-metadata-oych.vercel.app/api/health`
  - `https://xprmint-metadata-oych.vercel.app/api/crafted/metadata/1`
- The main XPRMINT site (Vite SPA) is **separate** and continues to live on the `www.xprmint.com` Vercel project.
- When changing **on-chain struct fields** or **metadata JSON schema**, we touch the `xprmint-metadata` repo / project.
- When changing **site UI / UX**, we touch the main XPRMINT frontend repo / project.

This doc exists so future work doesn’t accidentally happen in the wrong repo or Vercel project.

---

## Current State

### 1. Metadata Project – `xprmint-metadata`

**Repo:**
- GitHub repo: `xprmint-metadata` (should be **private**).

**Vercel project:**
- Deployed at: `https://xprmint-metadata-oych.vercel.app/`
- Framework preset: **Other** (no Next.js / React framework).
- Build command: `npm run build` (no-op echo).
- Output: serverless functions under `api/**`.

**Key endpoints:**

- Health check:
  - `GET /api/health`
  - Example: `https://xprmint-metadata-oych.vercel.app/api/health`
  - Returns: `{ "ok": true }`

- Crafted metadata:
  - `GET /api/crafted/metadata/[id]`
  - Example: `https://xprmint-metadata-oych.vercel.app/api/crafted/metadata/1`

**Example response (token 1, verified):**

```json
{
  "name": "NPC #1",
  "description": "The first coin crafted in the NGMI Genesis Forge on ApeChain.",
  "image": "https://www.xprmint.com/coins/coin1a.png",
  "external_url": "https://crafted.xprmint.com/crafted/1",
  "attributes": [
    { "trait_type": "Item Class", "value": "Coin" },
    { "trait_type": "Forge", "value": "NGMI Genesis Forge" },
    { "trait_type": "Crafter", "value": "NPC #1" },
    { "trait_type": "NGT Locked", "value": 1000 }
  ],
  "properties_for_your_ui_only": {
    "recipe_id": 1,
    "npc_token_id": 1,
    "crafter_name": "NPC #1",
    "ngt_locked": 1000,
    "destroy_fee_bps": 1000,
    "ngt_fee_to_npc": 100,
    "ngt_return_to_bearer": 900,
    "unlock_at": 0,
    "unlocks_in_seconds": 0
  }
}
```

**Important:**
- This project is **metadata-only**.
- No SPA, no Vite, no Next router.
- Only serverless API routes under `api/`.
- We expect to touch this repo **rarely**, mainly when:
  - Changing the metadata JSON schema,
  - Wiring in on-chain reads (e.g., actual NGT locked, actual NPC name),
  - Adding new item classes / recipes.

### 2. Main XPRMINT Frontend – `www.xprmint.com`

**Repo:**
- The existing XPRMINT frontend repo (Vite/React SPA).
- This repo handles the user-facing site and app logic.

**Vercel project:**
- Custom domain: `https://www.xprmint.com`
- Uses Vite SPA bundling.
- Previously attempted to host metadata under `/api/crafted/metadata`, but **we no longer rely on that**.

**Now:**
- The frontend repo should focus only on **UI, UX, and client-side behavior**.
- Metadata responsibilities are delegated to the separate `xprmint-metadata` project.

---

## Contract Integration – Where tokenURI Points

For **Crafted V1** (MasterCrafterV1 + CraftedV1Positions):

- `tokenURI(tokenId)` should be built as:

```text
_BASE_METADATA_URL + tokenId
```

- And `_BASE_METADATA_URL` should currently be:

```text
"https://xprmint-metadata-oych.vercel.app/api/crafted/metadata/"
```

So for example:

- `tokenURI(1)` → `https://xprmint-metadata-oych.vercel.app/api/crafted/metadata/1`

Once a subdomain like `crafted.xprmint.com` is wired to this Vercel project, we can later update:

```text
_BASE_METADATA_URL = "https://crafted.xprmint.com/api/crafted/metadata/"
```

without changing the JSON shape.

---

## Best Practices – Which Repo / Project to Use

### When to Work in `xprmint-metadata` (metadata microservice)

Use this repo + Vercel project when:

- You are changing the **metadata schema** (adding/removing traits, updating `properties_for_your_ui_only`).
- You are wiring **on-chain enrichment**, e.g.:
  - Deriving `npc_token_id` from the actual seat on MasterCrafterV1,
  - Deriving `ngt_locked` from the actual position struct,
  - Calculating `unlock_at` and `unlocks_in_seconds` from on-chain timestamps.
- You are adding **new item classes / recipes** that need metadata.
- You need to adjust caching, rate limiting, or performance of the metadata endpoint.

Sanity checks when working here:

- Verify you’re in the `xprmint-metadata` repo.
- Verify the Vercel project URL matches `https://xprmint-metadata-oych.vercel.app`.
- Test locally with:
  - `curl -s http://localhost:3000/api/health`
  - `curl -s http://localhost:3000/api/crafted/metadata/1`

### When to Work in the main XPRMINT frontend repo

Use the main frontend repo when:

- You are working on the **site UI / UX** for XPRMINT.
- You are wiring in wallet connections, dashboards, or visualizations.
- You are consuming the metadata API **as a client**, not serving it.
- You are changing how the app links to `external_url` / crafted detail pages.

Sanity checks when working here:

- Verify that you are **not** editing `xprmint-metadata` by mistake.
- The deployment domain for this repo is `https://www.xprmint.com`.

---

## Vercel Project Mapping Summary

| Responsibility       | Repo                | Vercel Project Base URL                                          |
|----------------------|---------------------|------------------------------------------------------------------|
| Crafted metadata API | `xprmint-metadata`  | `https://xprmint-metadata-oych.vercel.app` (later: crafted.xprmint.com) |
| Main XPRMINT site    | XPRMINT frontend    | `https://www.xprmint.com`                                        |

---

## Future Changes – What Might Evolve

- **Subdomain:** Once DNS is wired, we will switch to a prettier base URL like:
  - `https://crafted.xprmint.com/api/crafted/metadata/`
- **On-chain data:**
  - NPC name pulled from MasterCrafterV1 or a registry / DB.
  - `ngt_locked` read directly from the position struct.
  - Dynamic `unlock_at` and `unlocks_in_seconds` based on lock duration.
- **XP logic:**
  - XP remains primarily an off-chain/indexer concern, but this metadata service may expose XP snapshots later via `properties_for_your_ui_only`.

For now, this doc is the source of truth for **where metadata lives, which Vercel project is responsible, and when we should be touching which repo**.

