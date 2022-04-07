// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPositionsManager is IERC721Enumerable {

    function mint(
        address to,
        uint128 discount,
        uint256 amount,
        uint256 atenStake,
        uint128[] calldata _protocolsIds
    ) external;
}
