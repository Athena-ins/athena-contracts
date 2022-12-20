// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IStakedAtenPolicy is IERC20 {
  function stake(
    address account_,
    uint256 policyId_,
    uint256 amount_
  ) external;

  function withdraw(address account_, uint256 policyId_)
    external
    returns (uint256);

  function setRewardsPerYear(uint256 newRate_) external;
}
