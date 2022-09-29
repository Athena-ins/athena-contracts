// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./IPolicyCover.sol";
import "../ClaimCover.sol";

//Thao@TODO: remove IPolicyCover
interface IProtocolPool is IPolicyCover {
  function deposit(address account, uint256 amount) external;

  function committingWithdrawLiquidity(address account) external;

  function removeCommittedWithdrawLiquidity(address account) external;

  function takeInterest(
    address account,
    uint256 userCapital,
    uint128[] calldata protocolIds,
    uint256 discount
  )
    external
    returns (uint256 newUserCapital, uint256 aaveScaledBalanceToRemove);

  function isWithdrawLiquidityDelayOk(address account)
    external
    view
    returns (bool);

  function withdrawLiquidity(
    address account,
    uint256 userCapital,
    uint128[] calldata protocolIds,
    uint128 discount
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

  function removeLPInfo(address account) external;

  function actualizing() external returns (uint256[] memory);

  function protocolInfo()
    external
    view
    returns (
      string memory symbol,
      string memory name,
      uint256 totalCouvrageValue,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate
    );
}
