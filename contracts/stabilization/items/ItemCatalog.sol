// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ItemCatalog
 * @notice Upgradeable catalog storing item templates and image pointers via SSTORE2
 * @dev Catalog is append-only; templates cannot be deleted or reordered
 */
contract ItemCatalog is Initializable, OwnableUpgradeable {
    /**
     * @notice Item template structure
     */
    struct ItemTemplate {
        uint8 rarity; // 0=Common, 1=Uncommon, 2=Rare, 3=Epic
        uint8 primaryTrait; // 0=Salinity, 1=pH, 2=Temperature, 3=Frequency, 4=None
        int16 primaryDelta; // Signed delta value
        uint8 secondaryTrait; // Interdependent trait or 4=None
        int16 secondaryDelta; // Signed delta value
        address imagePtr; // SSTORE2 address for image bytes (or address(0) if not set)
        string name; // Item name
        string description; // Item description
    }

    /// @notice Append-only array of templates
    ItemTemplate[] public templates;

    /// @notice Mapping from rarity to list of template IDs
    mapping(uint8 => uint256[]) public byRarity;

    /// @notice Total number of templates
    uint256 public templateCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the catalog
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        templateCount = 0;
    }

    /**
     * @notice Add a new template to the catalog (append-only)
     * @param tmpl Template data
     * @return templateId The ID of the newly added template
     */
    function addTemplate(
        ItemTemplate calldata tmpl
    ) external onlyOwner returns (uint256 templateId) {
        templateId = templates.length;
        templates.push(tmpl);
        byRarity[tmpl.rarity].push(templateId);
        templateCount++;
        
        emit TemplateAdded(templateId, tmpl.name);
    }

    /**
     * @notice Batch add templates
     * @param tmpls Array of templates to add
     * @return firstTemplateId The ID of the first added template
     */
    function addTemplatesBatch(
        ItemTemplate[] calldata tmpls
    ) external onlyOwner returns (uint256 firstTemplateId) {
        require(tmpls.length > 0, "ItemCatalog: empty batch");
        
        firstTemplateId = templates.length;
        
        for (uint256 i = 0; i < tmpls.length; i++) {
            uint256 templateId = templates.length;
            templates.push(tmpls[i]);
            byRarity[tmpls[i].rarity].push(templateId);
            templateCount++;
            
            emit TemplateAdded(templateId, tmpls[i].name);
        }
    }

    /**
     * @notice Get template by ID
     * @param templateId Template identifier
     * @return template ItemTemplate struct
     */
    function getTemplate(
        uint256 templateId
    ) external view returns (ItemTemplate memory template) {
        require(templateId < templates.length, "ItemCatalog: invalid templateId");
        return templates[templateId];
    }

    /**
     * @notice Get all template IDs for a given rarity
     * @param rarity Rarity constant (0-3)
     * @return templateIds Array of template IDs
     */
    function getTemplateIdsByRarity(
        uint8 rarity
    ) external view returns (uint256[] memory templateIds) {
        return byRarity[rarity];
    }

    /**
     * @notice Update image pointer for an existing template
     * @param templateId Template identifier
     * @param imagePtr New SSTORE2 address for image bytes
     */
    function updateTemplateImage(
        uint256 templateId,
        address imagePtr
    ) external onlyOwner {
        require(templateId < templates.length, "ItemCatalog: invalid templateId");
        templates[templateId].imagePtr = imagePtr;
        emit TemplateImageUpdated(templateId, imagePtr);
    }

    /**
     * @notice Update template name and description (metadata only, no gameplay changes)
     * @param templateId Template identifier
     * @param newName New item name
     * @param newDescription New item description
     */
    function updateTemplateMetadata(
        uint256 templateId,
        string calldata newName,
        string calldata newDescription
    ) external onlyOwner {
        require(templateId < templates.length, "ItemCatalog: invalid templateId");
        templates[templateId].name = newName;
        templates[templateId].description = newDescription;
        emit TemplateMetadataUpdated(templateId, newName, newDescription);
    }

    /**
     * @notice Update template name only (metadata only, no gameplay changes)
     * @param templateId Template identifier
     * @param newName New item name
     */
    function updateTemplateName(
        uint256 templateId,
        string calldata newName
    ) external onlyOwner {
        require(templateId < templates.length, "ItemCatalog: invalid templateId");
        templates[templateId].name = newName;
        emit TemplateMetadataUpdated(templateId, newName, templates[templateId].description);
    }

    /**
     * @notice Update template description only (metadata only, no gameplay changes)
     * @param templateId Template identifier
     * @param newDescription New item description
     */
    function updateTemplateDescription(
        uint256 templateId,
        string calldata newDescription
    ) external onlyOwner {
        require(templateId < templates.length, "ItemCatalog: invalid templateId");
        templates[templateId].description = newDescription;
        emit TemplateMetadataUpdated(templateId, templates[templateId].name, newDescription);
    }

    /**
     * @notice Get image bytes from SSTORE2 pointer
     * @param imagePtr SSTORE2 address
     * @return imageBytes Raw image bytes
     */
    function getImageBytes(
        address imagePtr
    ) external view returns (bytes memory imageBytes) {
        if (imagePtr == address(0)) {
            return "";
        }
        // SSTORE2.read(address) - using inline assembly for SSTORE2
        assembly {
            let size := extcodesize(imagePtr)
            imageBytes := mload(0x40)
            mstore(0x40, add(imageBytes, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(imageBytes, size)
            extcodecopy(imagePtr, add(imageBytes, 0x20), 0, size)
        }
    }

    /**
     * @notice Get image as base64 data URI
     * @param imagePtr SSTORE2 address
     * @param mimeType MIME type (e.g., "image/png", "image/svg+xml")
     * @return dataUri Base64-encoded data URI
     */
    function getImageDataUri(
        address imagePtr,
        string memory mimeType
    ) external view returns (string memory dataUri) {
        if (imagePtr == address(0)) {
            return "";
        }
        
        bytes memory imageBytes = this.getImageBytes(imagePtr);
        string memory base64 = Base64.encode(imageBytes);
        
        return string(
            abi.encodePacked("data:", mimeType, ";base64,", base64)
        );
    }

    event TemplateAdded(uint256 indexed templateId, string name);
    event TemplateImageUpdated(uint256 indexed templateId, address imagePtr);
    event TemplateMetadataUpdated(uint256 indexed templateId, string name, string description);
}


