// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IWETH {
  function name() external view returns (string memory);

  function symbol() external view returns (string memory);

  function decimals() external view returns (uint8);

  event Approval(
    address indexed src,
    address indexed guy,
    uint256 wad
  );
  event Transfer(
    address indexed src,
    address indexed dst,
    uint256 wad
  );
  event Deposit(address indexed dst, uint256 wad);
  event Withdrawal(address indexed src, uint256 wad);

  function balanceOf(address account) external view returns (uint256);

  function allowance(
    address src,
    address guy
  ) external view returns (uint256);

  function totalSupply() external view returns (uint256);

  function deposit() external payable;

  function withdraw(uint256 wad) external;

  function approve(address guy, uint256 wad) external returns (bool);

  function transfer(address dst, uint256 wad) external returns (bool);

  function transferFrom(
    address src,
    address dst,
    uint256 wad
  ) external returns (bool);
}
