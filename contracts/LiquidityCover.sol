// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./libraries/RayMath.sol";

import "hardhat/console.sol";

abstract contract LiquidityCover is ERC20 {
  using RayMath for uint256;

  event Mint(address owner, uint256 amount);

  uint128[] public relatedProtocols;

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

  function _intersectingAmount(uint128 _protocolId)
    internal
    view
    returns (uint256)
  {
    return intersectingAmounts[intersectingAmountIndexes[_protocolId]];
  }

  function _removeIntersectingAmount(
    uint128 _protocolId,
    uint256 _amountToRemove
  ) internal {
    intersectingAmounts[
      intersectingAmountIndexes[_protocolId]
    ] -= _amountToRemove;
  }

  function _addIntersectingAmount(uint128 _protocolId, uint256 _amountToAdd)
    internal
  {
    intersectingAmounts[intersectingAmountIndexes[_protocolId]] += _amountToAdd;
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
      ((_totalInsuredCapital + _insuredCapitalToAdd - _insuredCapitalToRemove) *
        100).rayDiv(_availableCapital);
  }

  function _removeAmountFromAvailableCapital(uint256 _amountToRemove) internal {
    availableCapital -= _amountToRemove;
  }

  function _liquidityIndex(uint256 _totalSupply, uint256 _totalCapital)
    internal
    pure
    returns (uint256)
  {
    return _totalSupply == 0 ? RayMath.RAY : _totalSupply.rayDiv(_totalCapital);
  }

  function _mintLiquidity(address _account, uint256 _amount) internal {
    _mint(_account, _amount);
    availableCapital += _amount;
  }
}
