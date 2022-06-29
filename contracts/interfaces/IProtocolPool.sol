// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./IPolicyCover.sol";

//Thao@TODO: remove IPolicyCover
interface IProtocolPool is IPolicyCover {
  function mint(address _account, uint256 _amount) external;

  function committingWithdrawLiquidity(address _account) external;

  function removeCommittedWithdrawLiquidity(address _account) external;

  function withdrawLiquidity(
    address _account,
    uint256 _userCapital,
    uint128 _discount,
    uint256 _accountTimestamp
  ) external returns (uint256);

  function releaseFunds(address _account, uint256 _amount) external;

  function buyPolicy(
    address _owner,
    uint256 _premium,
    uint256 _insuredCapital
  ) external;

  function withdrawPolicy(address _owner) external;
}
