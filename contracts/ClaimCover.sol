// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./LiquidityCover.sol";

abstract contract ClaimCover is LiquidityCover {
  using RayMath for uint256;

  // struct ClaimComplement {
  //   uint256 claimId;
  //   uint256 liquidityIndexBeforeClaim;
  // }

  struct Claim {
    uint128 fromProtocolId;
    uint256 ratio; // Ray //ratio = claimAmount / capital
    uint256 liquidityIndexBeforeClaim;
    uint256 aaveReserveNormalizedIncomeBeforeClaim;
  }

  Claim[] public claims;

  //Thao@NOTE: for testing
  function claimsCount() public view returns (uint256) {
    return claims.length;
  }

  function _claims(uint256 beginIndex) internal view returns (Claim[] memory) {
    uint256 __length = claims.length;
    if (__length == beginIndex) return new Claim[](0);

    __length = __length - beginIndex;
    Claim[] memory __claims = new Claim[](__length);
    for (uint256 i = 0; i < __length; i++) {
      __claims[i] = claims[beginIndex + i];
    }

    return __claims;
  }

  function _amountToRemoveFromIntersecAndCapital(
    uint256 _intersecAmount,
    uint256 _claimRatio
  ) internal pure returns (uint256) {
    return _intersecAmount.rayMul(_claimRatio);
  }
}
