// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./IPolicyCover.sol";
import "../ClaimCover.sol";

//Thao@TODO: remove IPolicyCover
interface IProtocolPool is IPolicyCover {
  function deposit(address _account, uint256 _amount) external;

  function committingWithdrawLiquidity(address _account) external;

  function removeCommittedWithdrawLiquidity(address _account) external;

  function takeInterest(
    address _account,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _discount
  )
    external
    returns (uint256 newUserCapital, uint256 aaveScaledBalanceToRemove);

  function isWithdrawLiquidityDelayOk(address _account)
    external
    view
    returns (bool);

  function withdrawLiquidity(
    address _account,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint128 _discount
  )
    external
    returns (uint256 newUserCapital, uint256 aaveScaledBalanceToRemove);

  function ratioWithAvailableCapital(uint256 _amount)
    external
    returns (uint256);

  function releaseFunds(address _account, uint256 _amount) external;

  function buyPolicy(
    address _owner,
    uint256 _tokenId,
    uint256 _premium,
    uint256 _insuredCapital
  ) external;

  function withdrawPolicy(address _owner) external;

  function processClaim(
    uint128 fromProtocolId,
    uint256 ratio,
    uint256 aaveReserveNormalizedIncome
  ) external;

  function getRelatedProtocols() external view returns (uint128[] memory);

  function addRelatedProtocol(uint128 _protocolId, uint256 _amount) external;

  function removeLPInfo(address _account) external;

  function actualizing() external returns (uint256[] memory);
}
