pragma solidity ^0.8.24;

import {ERC721C, ERC721CInitializable} from "creator-token-standards/erc721c/ERC721C.sol";
import "creator-token-standards/token/erc721/ERC721OpenZeppelin.sol";
import "creator-token-standards/programmable-royalties/BasicRoyalties.sol";
import "creator-token-standards/access/OwnableBasic.sol";
import "creator-token-standards/access/OwnablePermissions.sol";
import {ERC2981} from "creator-token-standards/@openzeppelin/contracts/token/common/ERC2981.sol";

import {IMasterCrafterV1} from "./IMasterCrafterV1.sol";

/**
 * @title CraftedV1Positions
 * @notice ERC721C positions implementation for Crafted V1 (proxy deploy).
 */
contract CraftedV1Positions is OwnableBasic, ERC721CInitializable, BasicRoyaltiesInitializable {
    address public masterCrafter;
    uint256 private _nextTokenId = 1;
    uint96 private constant DEFAULT_ROYALTY_BPS = 690; // 6.9%

    constructor() ERC721("", "") {}

    /**
     * @notice Proxy initializer.
     */
    function initialize(address owner_) external {
        require(masterCrafter == address(0), "InitOnce");
        _transferOwnership(owner_);
        initializeERC721("Crafted V1", "CRAFT");
        _setDefaultRoyalty(address(this), DEFAULT_ROYALTY_BPS);
    }

    function setMasterCrafter(address _master) external onlyOwner {
        require(_master != address(0), "InvalidMaster");
        masterCrafter = _master;
    }

    function mintPosition(address to) external returns (uint256 tokenId) {
        require(msg.sender == masterCrafter, "OnlyMasterCrafter");
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
    }

    function burnPosition(uint256 tokenId) external {
        require(msg.sender == masterCrafter, "OnlyMasterCrafter");
        _burn(tokenId);
    }

    function masterCrafterContract() internal view returns (IMasterCrafterV1) {
        return IMasterCrafterV1(masterCrafter);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "NonexistentToken");
        return masterCrafterContract().positionTokenURI(tokenId);
    }

    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        public
        view
        override(ERC2981)
        returns (address receiver, uint256 royaltyAmount)
    {
        require(_ownerOf(tokenId) != address(0), "NonexistentToken");
        receiver = masterCrafterContract().royaltyReceiverForPosition(tokenId);
        royaltyAmount = (salePrice * DEFAULT_ROYALTY_BPS) / 10_000;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721CInitializable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _requireCallerIsContractOwner() internal view virtual override(OwnableBasic, OwnablePermissions) {
        _checkOwner();
    }
}

