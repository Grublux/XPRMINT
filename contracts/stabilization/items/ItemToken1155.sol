// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ItemGenerator.sol";

/**
 * @title ItemToken1155
 * @notice ERC-1155 upgradeable token for stabilization items
 * @dev Items are minted by CreatureStabilizer only
 */
contract ItemToken1155 is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable
{
    using ItemGenerator for ItemGenerator.ItemData;

    /// @notice Address of CreatureStabilizer contract (only minter)
    address public stabilizer;
    address public itemCatalog;

    /// @notice SP yield per rarity
    mapping(uint8 => uint8) private _spYield;

    /// @notice Collection name (for marketplaces)
    string private _name;
    
    /// @notice Collection symbol (for marketplaces)
    string private _symbol;
    
    /// @notice Collection-level metadata URI (optional)
    string private _contractURI;

    /// @notice External image base URI for marketplace-friendly URLs.
    /// Optional: if empty, `uri()` will fall back to fully on-chain data URIs only.
    /// @dev When set, token metadata includes both:
    ///      - `image`: HTTP URL (base + id + ".png") for marketplace display
    ///      - `image_data`: On-chain data URI (base64 PNG from SSTORE2) for verification
    ///      Marketplaces like Magic Eden and ApeScan use the `image` field for fast loading,
    ///      while `image_data` ensures on-chain provenance and backward compatibility.
    string public externalImageBaseURI;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param baseURI Base URI for token metadata (unused in catalog system)
     * @param _itemCatalog Address of ItemCatalog contract
     */
    function initialize(
        string memory baseURI,
        address _itemCatalog
    ) public initializer {
        __ERC1155_init(baseURI);
        __Ownable_init(msg.sender);

        itemCatalog = _itemCatalog;

        // Initialize collection metadata with V1 defaults
        _name = "Stabilization Items V1";
        _symbol = "ITEMS";

        // Initialize SP yields (for backward compatibility)
        _spYield[ItemGenerator.RARITY_COMMON] = 1;
        _spYield[ItemGenerator.RARITY_UNCOMMON] = 2;
        _spYield[ItemGenerator.RARITY_RARE] = 3;
        _spYield[ItemGenerator.RARITY_EPIC] = 5;
    }

    /**
     * @notice Set the CreatureStabilizer address
     * @param _stabilizer Address of CreatureStabilizer
     */
    function setStabilizer(address _stabilizer) external onlyOwner {
        stabilizer = _stabilizer;
    }

    /**
     * @notice Set the ItemCatalog address (owner only)
     * @param newCatalog Address of new ItemCatalog contract
     */
    function setCatalog(address newCatalog) external onlyOwner {
        require(newCatalog != address(0), "ItemToken1155: catalog cannot be zero address");
        itemCatalog = newCatalog;
        emit CatalogUpdated(newCatalog);
    }

    /**
     * @notice Get collection name (for marketplaces)
     * @return Collection name
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @notice Get collection symbol (for marketplaces)
     * @return Collection symbol
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @notice Set collection name (owner only, cosmetic only)
     * @param newName New collection name
     */
    function setName(string calldata newName) external onlyOwner {
        _name = newName;
    }

    /**
     * @notice Set collection symbol (owner only, cosmetic only)
     * @param newSymbol New collection symbol
     */
    function setSymbol(string calldata newSymbol) external onlyOwner {
        _symbol = newSymbol;
    }

    /**
     * @notice Get collection-level metadata URI (for marketplaces)
     * @return Contract URI with collection metadata
     */
    function contractURI() public view returns (string memory) {
        if (bytes(_contractURI).length > 0) {
            return _contractURI;
        }
        
        // Generate default contract URI if not set
        // Note: Production deployments should call setContractURI with desired collection-level metadata
        string memory json = string(
            abi.encodePacked(
                '{"name":"',
                _name,
                '","description":"On-chain tools, artifacts, and anomalies used in stabilizing creatures within the NMGI ecosystem.","external_url":"https://xprmint.com","image":""}'
            )
        );
        
        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    /**
     * @notice Set collection-level metadata URI (owner only)
     * @param newContractURI New contract URI (can be data URI or HTTP URL)
     */
    function setContractURI(string calldata newContractURI) external onlyOwner {
        _contractURI = newContractURI;
    }

    /**
     * @notice Set external image base URI for marketplace-friendly image URLs (owner only)
     * @param base Base URI (e.g., "https://xprmint.com/items_full/")
     * @dev When set, token metadata will include both:
     *      - `image`: HTTP URL (base + id + ".png")
     *      - `image_data`: On-chain data URI (for purists)
     */
    function setExternalImageBaseURI(string calldata base) external onlyOwner {
        externalImageBaseURI = base;
    }

    /**
     * @notice Mint an item to an address (only by stabilizer)
     * @param to Recipient address
     * @param itemId Item ID (encoded ItemData)
     * @param amount Amount to mint
     */
    function mintItem(
        address to,
        uint256 itemId,
        uint256 amount
    ) external {
        require(msg.sender == stabilizer, "ItemToken1155: only stabilizer");
        _mint(to, itemId, amount, "");
    }

    /**
     * @notice Burn an item from an address (only by stabilizer)
     * @param from Address to burn from
     * @param itemId Item ID
     * @param amount Amount to burn
     */
    function burnItem(
        address from,
        uint256 itemId,
        uint256 amount
    ) external {
        require(msg.sender == stabilizer, "ItemToken1155: only stabilizer");
        _burn(from, itemId, amount);
    }

    /**
     * @notice Admin mint function for ops/testing
     * @param to Recipient address
     * @param id Item ID (template ID)
     * @param amount Amount to mint
     */
    function adminMint(address to, uint256 id, uint256 amount) external onlyOwner {
        _mint(to, id, amount, "");
    }

    /**
     * @notice Get item data from template ID
     * @param itemId Template ID (itemId = templateId in catalog system)
     * @return template ItemTemplate struct from catalog
     */
    function getItemData(
        uint256 itemId
    ) external view returns (ItemCatalog.ItemTemplate memory template) {
        ItemCatalog catalog = ItemCatalog(itemCatalog);
        return catalog.getTemplate(itemId);
    }

    /**
     * @notice Get SP yield for an item
     * @param itemId Template ID
     * @return yield SP yield (1-5) based on rarity
     */
    function spYield(uint256 itemId) external view returns (uint8) {
        ItemCatalog catalog = ItemCatalog(itemCatalog);
        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(itemId);
        return _spYield[template.rarity];
    }

    /**
     * @notice Override URI to return on-chain JSON encoding
     * @param itemId Template ID
     * @return uri JSON-encoded metadata URI
     */
    function uri(
        uint256 itemId
    ) public view override returns (string memory) {
        ItemCatalog catalog = ItemCatalog(itemCatalog);
        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(itemId);

        // Build JSON metadata
        string memory rarityName;
        if (template.rarity == ItemGenerator.RARITY_COMMON) rarityName = "Common";
        else if (template.rarity == ItemGenerator.RARITY_UNCOMMON)
            rarityName = "Uncommon";
        else if (template.rarity == ItemGenerator.RARITY_RARE) rarityName = "Rare";
        else rarityName = "Epic";

        string memory primaryTraitName;
        if (template.primaryTrait == ItemGenerator.TRAIT_SALINITY)
            primaryTraitName = "Salinity";
        else if (template.primaryTrait == ItemGenerator.TRAIT_PH)
            primaryTraitName = "pH";
        else if (template.primaryTrait == ItemGenerator.TRAIT_TEMPERATURE)
            primaryTraitName = "Temperature";
        else if (template.primaryTrait == ItemGenerator.TRAIT_FREQUENCY)
            primaryTraitName = "Frequency";
        else primaryTraitName = "None";

        // Build JSON string using template data
        string memory json = string(
            abi.encodePacked(
                '{"name":"',
                template.name,
                '",',
                '"description":"',
                template.description,
                '",',
                '"collection":"Stabilization Items V3",',
                '"attributes":[',
                '{"trait_type":"Item Name","value":"',
                template.name,
                '"}',
                ',{"trait_type":"Rarity","value":"',
                rarityName,
                '"}'
            )
        );

        // Add primary trait if not epic
        if (template.rarity != ItemGenerator.RARITY_EPIC) {
            json = string(
                abi.encodePacked(
                    json,
                    ',{"trait_type":"Primary Trait","value":"',
                    primaryTraitName,
                    '"}',
                    ',{"trait_type":"Primary Delta Magnitude","value":',
                    _intToString(template.primaryDelta),
                    '}'
                )
            );

            // Add secondary trait
            string memory secondaryTraitName;
            if (template.secondaryTrait == ItemGenerator.TRAIT_SALINITY)
                secondaryTraitName = "Salinity";
            else if (template.secondaryTrait == ItemGenerator.TRAIT_PH)
                secondaryTraitName = "pH";
            else if (template.secondaryTrait == ItemGenerator.TRAIT_TEMPERATURE)
                secondaryTraitName = "Temperature";
            else if (template.secondaryTrait == ItemGenerator.TRAIT_FREQUENCY)
                secondaryTraitName = "Frequency";
            else secondaryTraitName = "None";

            json = string(
                abi.encodePacked(
                    json,
                    ',{"trait_type":"Secondary Trait","value":"',
                    secondaryTraitName,
                    '"}',
                    ',{"trait_type":"Secondary Delta Magnitude","value":',
                    _intToString(template.secondaryDelta),
                    '}'
                )
            );
        }

        // Add SP yield
        json = string(
            abi.encodePacked(
                json,
                ',{"trait_type":"SP Yield","value":',
                _uintToString(uint256(_spYield[template.rarity])),
                '}'
            )
        );

        // Close attributes array
        json = string(abi.encodePacked(json, "]"));

        // Build image fields: both marketplace URL and on-chain data URI
        string memory onChainImageDataUri = "";
        if (template.imagePtr != address(0)) {
            onChainImageDataUri = catalog.getImageDataUri(template.imagePtr, "image/png");
        }

        // Determine the `image` field value:
        // - If externalImageBaseURI is set, use HTTP URL (marketplace-friendly)
        // - Otherwise, fall back to on-chain data URI (backward compatible)
        string memory imageUrl;
        if (bytes(externalImageBaseURI).length > 0 && bytes(onChainImageDataUri).length > 0) {
            // Use external URL: baseURI + id + ".png"
            imageUrl = string(abi.encodePacked(externalImageBaseURI, Strings.toString(itemId), ".png"));
        } else if (bytes(onChainImageDataUri).length > 0) {
            // Fallback to on-chain data URI
            imageUrl = onChainImageDataUri;
        }

        // Add image and image_data fields if we have image data
        if (bytes(onChainImageDataUri).length > 0) {
            json = string(
                abi.encodePacked(
                    json,
                    ',"image":"',
                    imageUrl,
                    '"'
                )
            );
            
            // Always include image_data for on-chain purists
            json = string(
                abi.encodePacked(
                    json,
                    ',"image_data":"',
                    onChainImageDataUri,
                    '"'
                )
            );
        }

        json = string(abi.encodePacked(json, "}"));

        // Encode to base64
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(bytes(json))
                )
            );
    }

    // Helper functions for JSON encoding
    function _intToString(int16 value) internal pure returns (string memory) {
        if (value < 0) {
            return string(abi.encodePacked("-", _uintToString(uint256(uint16(-value)))));
        }
        return _uintToString(uint256(uint16(value)));
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    event CatalogUpdated(address indexed newCatalog);
}

