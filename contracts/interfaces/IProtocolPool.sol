// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./IPolicyCover.sol";
import "../ClaimCover.sol";

//Thao@TODO: remove IPolicyCover
interface IProtocolPool is IPolicyCover {
  struct LPInfo {
    uint256 beginLiquidityIndex;
    uint256 beginClaimIndex;
  }

  function deposit(uint256 tokenId, uint256 amount) external;

  function committingWithdrawLiquidity(uint256 tokenId) external;

  function removeCommittedWithdrawLiquidity(uint256 tokenId) external;

  function rewardsOf(
    uint256 tokenId,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _feeRate,
    uint256 _dateInSecond
  )
    external
    view
    returns (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo
    );

  function takeInterest(
    address account,
    uint256 tokenId,
    uint256 userCapital,
    uint128[] calldata protocolIds,
    uint256 feeRate
  )
    external
    returns (uint256 newUserCapital, uint256 aaveScaledBalanceToRemove);

  function isWithdrawLiquidityDelayOk(uint256 tokenId)
    external
    view
    returns (bool);

  function withdrawLiquidity(
    address account,
    uint256 tokenId,
    uint256 userCapital,
    uint128[] calldata protocolIds,
    uint128 feeRate
  )
    external
    returns (uint256 newUserCapital, uint256 aaveScaledBalanceToRemove);

  function ratioWithAvailableCapital(uint256 amount) external returns (uint256);

  function buyPolicy(
    address owner,
    uint256 tokenId,
    uint256 premium,
    uint256 insuredCapital
  ) external;

  function withdrawPolicy(address owner, uint256 amountCovered)
    external
    returns (uint256 remainedPremium);

  function processClaim(
    uint128 fromProtocolId,
    uint256 ratio,
    uint256 aaveReserveNormalizedIncome
  ) external;

  function getRelatedProtocols() external view returns (uint128[] memory);

  function addRelatedProtocol(uint128 protocolId, uint256 amount) external;

  function removeLPInfo(uint256 tokenId) external;

  function actualizing() external returns (uint256[] memory);

  function protocolInfo()
    external
    view
    returns (
      string memory name,
      uint256 totalCouvrageValue,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate
    );
}
