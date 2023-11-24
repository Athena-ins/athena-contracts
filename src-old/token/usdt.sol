// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDT is ERC20 {
  uint8 internal _decimals;

  constructor(
    string memory tokenName_,
    string memory tokenSymbol_,
    uint8 decimals_
  ) ERC20(tokenName_, tokenSymbol_) {
    _decimals = decimals_;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  function mint(uint256 _amount) public {
    require(_amount > 0, "Amount must be greater than 0");
    _mint(msg.sender, _amount);
  }
}
