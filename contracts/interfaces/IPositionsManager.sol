// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IPositionsManager {
    function addLiquidity(
        address to,
        uint256 id,
        uint256 amount,
        uint128[] calldata protocolsId
    ) external;
}
