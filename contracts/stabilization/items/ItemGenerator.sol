// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ItemCatalog.sol";

/**
 * @title ItemGenerator
 * @notice Library for deterministic template selection matching Python simulation
 * @dev Uses ItemCatalog to select templates based on rarity
 */
library ItemGenerator {
    // Rarity constants
    uint8 public constant RARITY_COMMON = 0;
    uint8 public constant RARITY_UNCOMMON = 1;
    uint8 public constant RARITY_RARE = 2;
    uint8 public constant RARITY_EPIC = 3;

    // Trait indices
    uint8 public constant TRAIT_SALINITY = 0;
    uint8 public constant TRAIT_PH = 1;
    uint8 public constant TRAIT_TEMPERATURE = 2;
    uint8 public constant TRAIT_FREQUENCY = 3;
    uint8 public constant TRAIT_NONE = 4;

    // Epic unlock
    uint8 public constant EPIC_UNLOCK_DAY = 7;
    uint256 public constant EPIC_RARITY_FRACTION = 200; // 2% = 200/10000

    // Primary delta ranges (min, max)
    int16 public constant COMMON_MIN = 2;
    int16 public constant COMMON_MAX = 3;
    int16 public constant UNCOMMON_MIN = 3;
    int16 public constant UNCOMMON_MAX = 5;
    int16 public constant RARE_MIN = 4;
    int16 public constant RARE_MAX = 6;

    // Secondary scale range (15-30% of primary)
    uint256 public constant SECONDARY_SCALE_MIN = 15; // 0.15 * 100
    uint256 public constant SECONDARY_SCALE_MAX = 30; // 0.30 * 100

    /**
     * @notice Get primary delta range for a rarity
     */
    function getPrimaryDeltaRange(
        uint8 rarity
    ) internal pure returns (int16 min, int16 max) {
        if (rarity == RARITY_COMMON) return (COMMON_MIN, COMMON_MAX);
        if (rarity == RARITY_UNCOMMON) return (UNCOMMON_MIN, UNCOMMON_MAX);
        if (rarity == RARITY_RARE) return (RARE_MIN, RARE_MAX);
        return (0, 0);
    }

    /**
     * @notice Get secondary trait for a primary trait (interdependence)
     */
    function getSecondaryTrait(
        uint8 primaryTrait
    ) internal pure returns (uint8) {
        if (primaryTrait == TRAIT_SALINITY) return TRAIT_TEMPERATURE;
        if (primaryTrait == TRAIT_TEMPERATURE) return TRAIT_FREQUENCY;
        if (primaryTrait == TRAIT_PH) return TRAIT_FREQUENCY;
        if (primaryTrait == TRAIT_FREQUENCY) return TRAIT_TEMPERATURE;
        return TRAIT_NONE;
    }

    /**
     * @notice Item data structure
     */
    struct ItemData {
        uint8 rarity;
        uint8 primaryTrait;
        int16 primaryDelta;
        uint8 secondaryTrait;
        int16 secondaryDelta;
        uint32 epicSeed;
    }

    /**
     * @notice Derive deterministic seed from creature ID, day index, and global entropy
     * @param creatureId Creature identifier
     * @param dayIndex Current day index
     * @param globalEntropy Global entropy bytes32
     * @return seed 32-byte seed
     */
    function deriveSeed(
        uint256 creatureId,
        uint256 dayIndex,
        bytes32 globalEntropy
    ) internal pure returns (bytes32 seed) {
        return keccak256(abi.encodePacked(creatureId, dayIndex, globalEntropy));
    }

    /**
     * @notice Determine rarity for a given day
     * @param dayIndex Current day index
     * @param seed Seed bytes32
     * @return rarity Rarity constant (0-3)
     */
    function rarityForDay(
        uint256 dayIndex,
        bytes32 seed
    ) internal pure returns (uint8 rarity) {
        uint256 r = uint256(seed) % 10000; // 0-9999 for precision

        if (dayIndex < EPIC_UNLOCK_DAY) {
            // Before epic unlock: C/U/R only
            if (r < 6000) return RARITY_COMMON; // 60%
            if (r < 8500) return RARITY_UNCOMMON; // 25%
            return RARITY_RARE; // 15%
        } else {
            // After epic unlock: 2% epic chance
            if (r < EPIC_RARITY_FRACTION) return RARITY_EPIC;

            // Remaining 98% split: 60/25/15
            uint256 r2 = (r - EPIC_RARITY_FRACTION) % 9800; // 0-9799
            if (r2 < 5880) return RARITY_COMMON; // 60% of 98%
            if (r2 < 8330) return RARITY_UNCOMMON; // 25% of 98%
            return RARITY_RARE; // 15% of 98%
        }
    }

    /**
     * @notice Select primary trait index from seed
     * @param seed Seed bytes32
     * @return trait Trait index (0-3)
     */
    function primaryTraitFromSeed(
        bytes32 seed
    ) internal pure returns (uint8 trait) {
        return uint8(uint256(seed) >> 4) % 4;
    }

    /**
     * @notice Compute primary delta from seed
     * @param rarity Rarity constant
     * @param seed Seed bytes32
     * @param direction +1 toward target, -1 away
     * @return delta Signed delta value
     */
    function primaryDeltaFromSeed(
        uint8 rarity,
        bytes32 seed,
        int16 direction
    ) internal pure returns (int16 delta) {
        if (rarity == RARITY_EPIC) return 0; // Epic doesn't use primary delta

        (int16 min, int16 max) = getPrimaryDeltaRange(rarity);
        uint256 rangeSize = uint256(int256(max) - int256(min) + 1);
        uint256 offset = (uint256(seed) >> 8) % 256;
        int16 magnitude = int16(int256(min) + int256(offset % rangeSize));

        return direction * magnitude;
    }

    /**
     * @notice Compute secondary trait and delta from interdependence
     * @param primaryTrait Primary trait index
     * @param primaryDelta Primary delta (signed)
     * @param seed Seed bytes32
     * @return trait Secondary trait index
     * @return delta Secondary delta (signed)
     */
    function secondaryTraitAndDelta(
        uint8 primaryTrait,
        int16 primaryDelta,
        bytes32 seed
    ) internal pure returns (uint8 trait, int16 delta) {
        trait = getSecondaryTrait(primaryTrait);

        // Scale factor: 15-30% of primary magnitude
        uint256 scaleOffset = (uint256(seed) >> 12) % 100;
        uint256 scaleRange = SECONDARY_SCALE_MAX - SECONDARY_SCALE_MIN;
        uint256 scale = SECONDARY_SCALE_MIN + (scaleOffset * scaleRange) / 100;

        uint256 primaryMagnitude = primaryDelta < 0 ? uint256(uint16(-primaryDelta)) : uint256(uint16(primaryDelta));
        uint256 secondaryMagnitude = (primaryMagnitude * scale) / 100;
        if (secondaryMagnitude < 1) secondaryMagnitude = 1;

        int16 secondaryDeltaValue = int16(int256(secondaryMagnitude));
        if (primaryDelta < 0) secondaryDeltaValue = -secondaryDeltaValue;

        return (trait, secondaryDeltaValue);
    }

    /**
     * @notice Generate a template ID deterministically using catalog
     * @param creatureId Creature identifier
     * @param dayIndex Current day index
     * @param globalEntropy Global entropy bytes32
     * @param catalog Address of ItemCatalog contract
     * @return templateId Template ID from catalog
     */
    function generateTemplateId(
        uint256 creatureId,
        uint256 dayIndex,
        bytes32 globalEntropy,
        ItemCatalog catalog
    ) internal view returns (uint256 templateId) {
        bytes32 seed = deriveSeed(creatureId, dayIndex, globalEntropy);

        // Determine rarity (same logic as before)
        uint8 rarity = rarityForDay(dayIndex, seed);

        // Get template IDs for this rarity from catalog
        uint256[] memory templateIds = catalog.getTemplateIdsByRarity(rarity);
        
        require(templateIds.length > 0, "ItemGenerator: no templates for rarity");

        // Select template ID deterministically from seed
        uint256 idx = uint256(seed) % templateIds.length;
        templateId = templateIds[idx];

        return templateId;
    }

    /**
     * @notice Generate item data from template (for backward compatibility)
     * @param templateId Template ID
     * @param catalog Address of ItemCatalog contract
     * @param seed Seed bytes32 (for direction determination)
     * @return item ItemData struct
     */
    function generateItemFromTemplate(
        uint256 templateId,
        ItemCatalog catalog,
        bytes32 seed
    ) internal view returns (ItemData memory item) {
        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(templateId);
        
        item.rarity = template.rarity;
        item.primaryTrait = template.primaryTrait;
        item.secondaryTrait = template.secondaryTrait;

        // Determine direction from seed (in practice, would use creature state)
        int16 direction = (uint256(seed) >> 16) % 2 == 0 ? int16(1) : int16(-1);
        
        item.primaryDelta = template.primaryDelta * direction;
        item.secondaryDelta = template.secondaryDelta * direction;

        if (template.rarity == RARITY_EPIC) {
            item.epicSeed = uint32(uint256(seed));
        } else {
            item.epicSeed = 0;
        }

        return item;
    }

    /**
     * @notice Generate a complete item deterministically (legacy - uses catalog)
     * @param creatureId Creature identifier
     * @param dayIndex Current day index
     * @param globalEntropy Global entropy bytes32
     * @param catalog Address of ItemCatalog contract
     * @return item ItemData struct
     */
    function generateItem(
        uint256 creatureId,
        uint256 dayIndex,
        bytes32 globalEntropy,
        ItemCatalog catalog
    ) internal view returns (ItemData memory item) {
        bytes32 seed = deriveSeed(creatureId, dayIndex, globalEntropy);
        uint256 templateId = generateTemplateId(creatureId, dayIndex, globalEntropy, catalog);
        return generateItemFromTemplate(templateId, catalog, seed);
    }

    /**
     * @notice In catalog system, itemId = templateId
     * @dev No encoding needed - templateId is used directly
     * @param templateId Template ID
     * @return itemId Same as templateId
     */
    function encodeTemplateId(
        uint256 templateId
    ) internal pure returns (uint256 itemId) {
        return templateId;
    }

    /**
     * @notice In catalog system, itemId = templateId
     * @dev No decoding needed - itemId is templateId
     * @param itemId Item ID (which is templateId)
     * @return templateId Same as itemId
     */
    function decodeTemplateId(
        uint256 itemId
    ) internal pure returns (uint256 templateId) {
        return itemId;
    }
}

