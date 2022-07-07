// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./libraries/RayMath.sol";

abstract contract LiquidityCover is ERC20 {
  using RayMath for uint256;

  event Mint(address owner, uint256 amount);

  uint128[] public relatedProtocols;

  //ce même protocol est à l'indice 0 mais il faut enlever pour gas
  mapping(uint128 => uint256) public intersectingAmountIndexes;
  uint256[] public intersectingAmounts;

  uint256 public availableCapital;

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

  //Thao@QUESTION: we need this fct ?
  function _intersectingAmounts() internal view returns (uint256[] memory) {
    return intersectingAmounts;
  }

  // returns actual usage rate on capital insured / capital provided for insurance
  function _utilisationRate(
    bool _isAdded,
    uint256 _insuredCapital,
    uint256 _totalInsuredCapital,
    uint256 _availableCapital
  ) internal pure returns (uint256) {
    if (_availableCapital == 0) {
      return 0;
    }
    return
      _isAdded
        ? ((_totalInsuredCapital + _insuredCapital) * 100).rayDiv(
          _availableCapital
        )
        : ((_totalInsuredCapital - _insuredCapital) * 100).rayDiv(
          _availableCapital
        );
  }

  function _liquidityIndex(uint256 _totalSupply, uint256 _totalCapital)
    internal
    pure
    returns (uint256)
  {
    return _totalSupply == 0 ? RayMath.RAY : _totalSupply.rayDiv(_totalCapital);
  }

  function _mintLiquidity(
    address _account,
    uint256 _amount,
    uint256 _premiumSpent
  ) internal {
    _mint(
      _account,
      (
        _amount.rayMul(
          _liquidityIndex(totalSupply(), availableCapital + _premiumSpent)
        )
      )
    );

    availableCapital += _amount;
  }

  function _scaledBalance(address _account, uint256 _premiumSpent)
    internal
    view
    returns (uint256)
  {
    uint256 __liquidityIndex = _liquidityIndex(
      totalSupply(),
      availableCapital + _premiumSpent
    );

    return balanceOf(_account).rayDiv(__liquidityIndex);
  }

  /**
   * @dev burn some LP tokens corresponding to the _amount in capital
   * @param _account account to burn capital from
   * @param _amount amount of capital to burn, will be converted to LP tokens
   * @param _premiumSpent amount of actual premium spent
   */
  function _burnCapital(
    address _account,
    uint256 _amount,
    uint256 _premiumSpent
  ) internal {
    // Need to remove from gobal capital ? availableCapital -= _amount;
    _burn(
      _account,
      _amount.rayMul(
        _liquidityIndex(totalSupply(), availableCapital + _premiumSpent)
      )
    );
  }
}
