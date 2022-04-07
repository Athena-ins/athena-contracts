// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "../library/PositionsLibrary.sol";

interface IPositionsManager is IERC721Enumerable {

    function addLiquidity(
        address to,
        uint128 discount,
        uint256 amount,
        uint256 atenStake,
        PositionsLibrary.ProtocolPosition[] calldata _protocolsPositions
    ) external;
}
