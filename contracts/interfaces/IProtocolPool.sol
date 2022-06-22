// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IPolicyCover.sol";

interface IProtocolPool is IPolicyCover {
  function mint(address _account, uint256 _amount) external;

  function committingWithdraw(address _account) external;

  function removeCommittedWithdraw(address _account) external;

  function withdraw(
    address _account,
    uint256 _userCapital,
    uint128 _discount,
    uint256 _accountTimestamp
  ) external returns (uint256);

  function releaseFunds(address _account, uint256 _amount) external;
}
