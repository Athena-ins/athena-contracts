// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { ERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract ATEN is IERC20, ERC20, Ownable {
  bool public isFrozen;

  constructor() ERC20("Athena", "ATEN") Ownable(msg.sender) {
    _mint(msg.sender, 3_000_000_000 ether);
    // isFrozen = true;
  }

  error TokensStillFrozen();

  // function _transfer(
  //   address sender,
  //   address recipient,
  //   uint256 amount
  // ) internal override(ERC20) {
  //   if (isFrozen) {
  //     if (sender != owner()) {
  //       revert TokensStillFrozen();
  //     }
  //   }
  //   super._transfer(sender, recipient, amount);
  // }
}
