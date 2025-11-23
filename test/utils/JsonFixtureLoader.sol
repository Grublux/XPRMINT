// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {stdJson} from "forge-std/StdJson.sol";
import {Vm} from "forge-std/Vm.sol";

/**
 * @title JsonFixtureLoader
 * @notice Utility for loading JSON fixtures in Foundry tests
 */
library JsonFixtureLoader {
    using stdJson for string;

    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /**
     * @notice Load item stream fixture
     * @param fixturePath Path to fixture JSON file
     * @return items Array of item data
     */
    function loadItemStream(
        string memory fixturePath
    ) internal returns (ItemFixture[] memory items) {
        string memory json = vm.readFile(fixturePath);
        bytes memory itemsData = json.parseRaw("$");
        return abi.decode(itemsData, (ItemFixture[]));
    }

    /**
     * @notice Load epic examples fixture
     * @param fixturePath Path to epic examples JSON
     * @return examples Array of epic examples
     */
    function loadEpicExamples(
        string memory fixturePath
    ) internal returns (EpicExample[] memory examples) {
        string memory json = vm.readFile(fixturePath);
        bytes memory examplesData = json.parseRaw("$");
        return abi.decode(examplesData, (EpicExample[]));
    }

    struct ItemFixture {
        uint256 day;
        uint256 item_index;
        uint256 day_index_for_item;
        uint256 creature_id;
        ItemData item;
        uint256 item_id;
    }

    struct ItemData {
        string rarity;
        string primaryTrait;
        int256 primaryDelta;
        string secondaryTrait;
        int256 secondaryDelta;
        uint256 epicSeed;
    }

    struct EpicExample {
        TraitState before;
        ItemData item;
        TraitState afterState;
    }

    struct TraitState {
        uint256 salinity;
        uint256 ph;
        uint256 temperature;
        uint256 frequency;
    }
}

