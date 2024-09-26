// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Contracts
import { ERC20 } from "../tokens/ERC20.sol";

contract MockToken is ERC20 {
  //======== CONSTRUCTOR ========//

  constructor(
    string memory name,
    string memory symbol,
    uint256 initialSupply
  ) ERC20(name, symbol) {
    _mint(msg.sender, initialSupply);
  }
}
