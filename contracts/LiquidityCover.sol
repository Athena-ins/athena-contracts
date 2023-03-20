// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { RayMath } from "./libraries/RayMath.sol";

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
    return
      (((_totalInsuredCapital + _insuredCapitalToAdd) -
        _insuredCapitalToRemove) * 100).rayDiv(_availableCapital);
  }
}
