// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { RayMath } from "./lib/RayMath.sol";

abstract contract LiquidityCover {
  using RayMath for uint256;

  uint128[] public relatedProtocols;

  // @bw This could probably be replace by a poolId -> amount mapping
  // Maps poolId -> overlapped capital amount
  mapping(uint128 => uint256) public intersectingAmountIndexes;
  uint256[] public intersectingAmounts;

  uint256 public availableCapital;

  uint256 public liquidityIndex;

  function updateLiquidityIndex(
    uint256 _uRate,
    uint256 _pRate,
    uint256 _deltaT
  ) internal {
    liquidityIndex += (_uRate.rayMul(_pRate) * _deltaT) / 31536000;
  }

  // returns actual usage rate on capital insured / capital provided for insurance
  function _utilisationRate(
    uint256 _insuredCapitalToAdd,
    uint256 _insuredCapitalToRemove,
    uint256 _totalInsuredCapital,
    uint256 _availableCapital
  ) internal pure returns (uint256) {
    if (_availableCapital == 0) {
      return 0;
    }
    uint256 utilizationRate = (((_totalInsuredCapital + _insuredCapitalToAdd) -
      _insuredCapitalToRemove) * 100).rayDiv(_availableCapital);

    //  @bw problem if usage is above 100% (ex: 100$ insured and 1$ capital)
    // In this case the usage should be ajusted to reflect available capital
    // The ratio should be slightly favorable for liquidity provider to incentivise equilibrium
    // Special rules for +100% -> adapt uRate to be based on capital + bonus to incentivize provider
    // 100% = 100 000000000000000000000000000 (rays)

    return utilizationRate;
  }
}
