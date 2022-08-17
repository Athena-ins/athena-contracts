// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./LiquidityCover.sol";

abstract contract ClaimCover is LiquidityCover {
  using RayMath for uint256;

  //Claim peut utiliser pour withdraw aussi
  struct Claim {
    uint128 fromProtocolId;
    uint256 amount; // Ray //cai nay ko can thiet
    uint256 ratio; // Ray //ratio = claimAmount / capital
    //uint256 liquidityIndexBeforeClaim;
    uint256 createdAt;
  }

  Claim[] public claims;

  function _addClaim(Claim memory _newClaim) internal {
    claims.push(_newClaim);
  }

  function _claims(uint256 beginIndex) internal view returns (Claim[] memory) {
    uint256 __length = claims.length;
    if (__length == beginIndex) return new Claim[](0);

    __length = claims.length - beginIndex;
    Claim[] memory __claims = new Claim[](__length);
    for (uint256 i = 0; i < __length; i++) {
      __claims[i] = claims[beginIndex + i];
    }

    return __claims;
  }

  //_claimAmount is Claim.amount
  //use for calculing Claim.ratio
  function _claimAmountRatio(uint256 _claimAmount)
    internal
    view
    returns (uint256)
  {
    return _claimAmount.rayDiv(availableCapital);
  }

  function _amountToRemoveFromIntersecAndCapital(
    uint256 _intersecAmount,
    uint256 _claimRatio
  ) internal pure returns (uint256) {
    return _intersecAmount.rayMul(_claimRatio);
  }

  //Thao@TODO: use later for rewardsOf LP
  function _ratioBetweenDepositAndIntersec(
    uint256 _depositAmount,
    uint256 _intersecAmount
  ) internal pure returns (uint256) {
    return _depositAmount.rayDiv(_intersecAmount);
  }

  //Thao@TODO: use later for rewardsOf LP
  function _amountToRemoveFromDeposit(
    uint256 _amountToRemoveFromIntersec,
    uint256 _depositRatio
  ) internal pure returns (uint256) {
    return _amountToRemoveFromIntersec.rayMul(_depositRatio);
  }
}
