import type { VercelRequest, VercelResponse } from "@vercel/node";

type Attribute = {
  trait_type: string;
  value: string | number;
};

type CraftedMetadata = {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Attribute[];
  properties_for_your_ui_only?: Record<string, string | number>;
};

const RECIPE_DEFAULTS: Record<
  string,
  {
    forgeName: string;
    description: string;
    image: string;
    itemClass: string;
    ngtLocked: number;
  }
> = {
  "1": {
    forgeName: "NGMI Genesis Forge",
    description: "The first coin crafted in the NGMI Genesis Forge on ApeChain.",
    image: "https://www.xprmint.com/coins/coin1a.png",
    itemClass: "Coin",
    ngtLocked: 1000,
  },
};

const NPC_CUSTOM_NAMES: Record<number, string> = {
  // TODO: later, override with on-chain or DB-based NPC names
};

function getNpcDisplayName(npcTokenId: number): string {
  const custom = NPC_CUSTOM_NAMES[npcTokenId];
  if (custom && custom.trim().length > 0) {
    return custom;
  }
  return `NPC #${npcTokenId}`;
}

function buildMetadataForToken(tokenId: number): CraftedMetadata {
  // TODO: later, derive recipeId, npcTokenId, ngtLocked, unlockAt from MasterCrafterV1 / indexer.
  const recipeId = 1;
  const npcTokenId = 1;

  const recipe = RECIPE_DEFAULTS[String(recipeId)];
  const npcName = getNpcDisplayName(npcTokenId);

  const unlockAtUnix = 0;
  const unlocksInSeconds = 0;

  return {
    name: npcName,
    description: recipe.description,
    image: recipe.image,
    external_url: `https://www.xprmint.com/crafted/${tokenId}`,
    attributes: [
      { trait_type: "Item Class", value: recipe.itemClass },
      { trait_type: "Forge", value: recipe.forgeName },
      { trait_type: "Crafter", value: npcName },
      { trait_type: "NGT Locked", value: recipe.ngtLocked },
    ],
    properties_for_your_ui_only: {
      recipe_id: recipeId,
      npc_token_id: npcTokenId,
      ngt_locked: recipe.ngtLocked,
      destroy_fee_bps: 1000,
      ngt_fee_to_npc: Math.floor(recipe.ngtLocked * 0.1),
      ngt_return_to_bearer: Math.floor(recipe.ngtLocked * 0.9),
      unlock_at: unlockAtUnix,
      unlocks_in_seconds: unlocksInSeconds,
    },
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const raw = Array.isArray(id) ? id[0] : id;

  const tokenId = raw ? Number(raw) : NaN;
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    res.status(400).json({ error: "Invalid token id" });
    return;
  }

  const metadata = buildMetadataForToken(tokenId);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  res.status(200).json(metadata);
}

