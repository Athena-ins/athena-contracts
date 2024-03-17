// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

//======== ERRORS ========//
error BalanceTooLow();
error AllowanceTooLow();

contract ERC20 is IERC20 {
  //======== STORAGE ========//

  string public name;
  string public symbol;
  uint8 public _decimals = 18;

  uint256 public totalSupply;
  mapping(address _account => uint256 _amount) public balanceOf;
  mapping(address _account => mapping(address _spender => uint256 _amount))
    public allowance;

  //======== CONSTRUCTOR ========//

  constructor(string memory name_, string memory symbol_) {
    name = name_;
    symbol = symbol_;
  }

  //======== FUNCTIONS ========//

  function decimals() external view returns (uint8) {
    return _decimals;
  }

  function _mint(
    address account,
    uint256 amount
  ) internal returns (bool) {
    balanceOf[account] += amount;
    totalSupply += amount;

    emit IERC20.Transfer(address(0), account, amount);
    return true;
  }

  function _burn(
    address account,
    uint256 amount
  ) internal returns (bool) {
    if (balanceOf[account] < amount) revert BalanceTooLow();

    unchecked {
      balanceOf[account] -= amount;
      totalSupply -= amount;
    }

    emit IERC20.Transfer(account, address(0), amount);
    return true;
  }

  function burn(uint256 amount) external returns (bool) {
    return _burn(msg.sender, amount);
  }

  function approve(
    address spender,
    uint256 amount
  ) external returns (bool) {
    allowance[msg.sender][spender] = amount;

    emit IERC20.Approval(msg.sender, spender, amount);
    return true;
  }

  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual returns (bool) {
    if (balanceOf[from] < amount) revert BalanceTooLow();

    unchecked {
      balanceOf[from] -= amount;
      balanceOf[to] += amount;
    }

    emit IERC20.Transfer(msg.sender, to, amount);
    return true;
  }

  function transfer(
    address to,
    uint256 amount
  ) external returns (bool) {
    return _transfer(msg.sender, to, amount);
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) external returns (bool) {
    uint256 allowed = allowance[from][msg.sender];

    if (allowed != type(uint256).max) {
      if (allowed < amount) revert AllowanceTooLow();
      unchecked {
        allowance[from][msg.sender] = allowed - amount;
      }
    }

    return _transfer(from, to, amount);
  }
}
