// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { ERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ATEN is ERC20 {
  constructor(
    string memory tokenName_,
    string memory tokenSymbol_,
    uint8 decimals_
  ) ERC20(tokenName_, tokenSymbol_) {}
}
