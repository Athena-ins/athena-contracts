// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IStakedAten is IERC20 {
  function stake(
    address _account,
    uint256 _amount,
    uint256 usdCapitalSupplied
  ) external;

  function withdraw(address _account, uint256 _amount) external;

  function positionOf(address _account) external view returns (uint256);
}
