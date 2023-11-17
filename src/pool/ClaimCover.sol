// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Parents
import { LiquidityCover } from "./LiquidityCover.sol";
// Libs
import { RayMath } from "../libs/RayMath.sol";

abstract contract ClaimCover is LiquidityCover {
  using RayMath for uint256;

  struct Claim {
    uint128 fromPoolId;
    uint256 ratio; // Ray //ratio = claimAmount / capital
    uint256 liquidityIndexBeforeClaim;
    uint256 aaveReserveNormalizedIncomeBeforeClaim;
  }

  Claim[] public processedClaims;

  // @bw Thao@NOTE: for testing
  function claimsCount() public view returns (uint256) {
    return processedClaims.length;
  }

  function _claims(uint256 beginIndex) internal view returns (Claim[] memory) {
    uint256 __length = processedClaims.length;
    if (__length == beginIndex) return new Claim[](0);

    __length = __length - beginIndex;
    Claim[] memory __claims = new Claim[](__length);
    for (uint256 i = 0; i < __length; i++) {
      __claims[i] = processedClaims[beginIndex + i];
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
