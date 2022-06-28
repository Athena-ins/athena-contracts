// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./LiquidityCover.sol";

abstract contract ClaimCover is LiquidityCover {
  using RayMath for uint256;

  struct Claim {
    uint128 disputeId;
    uint256 amount; // Ray
    uint256 ratio; // Ray
    uint256 createdAt;
    uint256 availableCapitalBefore; // Ray
    uint256 premiumSpentBefore; // Ray
  }

  Claim[] public claims;
  uint256 public claimIndex;

  function addClaim(Claim memory _newClaim) internal {
    claims.push(_newClaim);
  }

  function getClaims() internal view returns (Claim[] memory) {
    return claims;
  }

  //_claimAmount is Claim.amount
  //use for calculing Claim.ratio
  function claimAmountRatio(uint256 _claimAmount)
    internal
    view
    returns (uint256)
  {
    return _claimAmount.rayDiv(availableCapital);
  }

  function amountToRemoveFromIntersecAndCapital(
    uint256 _intersecAmount,
    uint256 _claimRatio
  ) internal pure returns (uint256) {
    return _intersecAmount.rayMul(_claimRatio);
  }

  //Thao@TODO: use later for rewardsOf LP
  function ratioBetweenDepositAndIntersec(
    uint256 _depositAmount,
    uint256 _intersecAmount
  ) internal pure returns (uint256) {
    return _depositAmount.rayDiv(_intersecAmount);
  }

  //Thao@TODO: use later for rewardsOf LP
  function amountToRemoveFromDeposit(
    uint256 _amountToRemoveFromIntersec,
    uint256 _depositRatio
  ) internal pure returns (uint256) {
    return _amountToRemoveFromIntersec.rayMul(_depositRatio);
  }

  //Thao@TODO: to remove
  function removeAmountFromCapital(uint256 _amountToRemove) internal {
    availableCapital -= _amountToRemove;
  }
}
