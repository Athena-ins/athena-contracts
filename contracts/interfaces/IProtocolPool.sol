// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IPolicyCover.sol";

//Thao@TODO: remove IPolicyCover
interface IProtocolPool is IPolicyCover {
  struct LPInfo {
    uint256 beginLiquidityIndex;
    uint256 beginClaimIndex;
  }

  function commitDelay() external view returns (uint128);

  function deposit(uint256 tokenId, uint256 amount) external;

  function rewardsOf(
    uint256 tokenId,
    uint256 _userCapital,
    uint128[] calldata _poolIds,
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
    uint128[] calldata poolIds,
    uint256 feeRate
  )
    external
    returns (uint256 newUserCapital, uint256 aaveScaledBalanceToRemove);

  function withdrawLiquidity(
    address account,
    uint256 tokenId,
    uint256 userCapital,
    uint128[] calldata poolIds,
    uint128 feeRate
  )
    external
    returns (uint256 newUserCapital, uint256 aaveScaledBalanceToRemove);

  function ratioWithAvailableCapital(uint256 amount) external returns (uint256);

  function buyPolicy(
    address owner,
    uint256 coverId,
    uint256 premiums,
    uint256 amountCovered
  ) external;

  function increaseCover(uint256 coverId, uint256 amount) external;

  function decreaseCover(uint256 coverId, uint256 amount) external;

  function addPremiums(uint256 coverId, uint256 amount) external;

  function removePremiums(
    uint256 coverId,
    uint256 amount,
    address account
  ) external;

  function withdrawPolicy(
    address owner,
    uint256 coverId,
    uint256 amountCovered
  ) external;

  function processClaim(
    uint128 fromPoolId,
    uint256 ratio,
    uint256 aaveReserveNormalizedIncome
  ) external;

  function getRelatedProtocols() external view returns (uint128[] memory);

  function addRelatedProtocol(uint128 poolId, uint256 amount) external;

  function actualizing() external returns (uint256[] memory);

  function protocolInfo()
    external
    view
    returns (
      uint256 insuredCapital,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate,
      Formula memory computingConfig
    );
}
