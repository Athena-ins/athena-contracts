// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Parents
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title AthenaToken (AOE), ERC-20 token
 * @notice Inherit from the ERC20Permit, allowing to sign approve off chain
 */
contract AOE is ERC20, ERC20Permit {
  constructor() ERC20("Aten", "AOE") ERC20Permit("AOE") {
    _mint(msg.sender, 3_000_000_000 ether);
  }
}
