// contracts/Box.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/utils/Multicall.sol";

contract Box is Multicall {
    function transfer() public pure {
        revert("Not ready function");
    }

}