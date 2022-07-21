// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IStakedAtenPolicy is IERC20 {
  function stake(address _account, uint256 _amount) external;

  function withdraw(
    address _account,
    uint256 _amount,
    uint128 _index
  ) external returns (uint256);
}
