// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./libraries/RayMath.sol";

import "hardhat/console.sol";

abstract contract LiquidityCover is ERC20 {
  using RayMath for uint256;

  event Mint(address owner, uint256 amount);

  uint128[] public relatedProtocols;

  //Thao@TODO: nous n'avons pas besoin de intersecting amount
  //ce même protocol est à l'indice 0 mais il faut enlever pour gas
  mapping(uint128 => uint256) public intersectingAmountIndexes;
  uint256[] public intersectingAmounts;

  uint256 public availableCapital;

  uint256 public totalSupplyReal;

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

  function _setTotalSupplyReal(uint256 _totalSupply) internal {
    totalSupplyReal = _totalSupply;
  }

  function _mintLiquidity(
    address _account,
    uint256 _amount,
    uint256 _premiumSpent
  ) internal {
    uint256 __amountToSupply = _amount.rayMul(
      _liquidityIndex(totalSupplyReal, availableCapital + _premiumSpent)
    );
    // console.log("__amountToSupply:", __amountToSupply);

    _mint(_account, __amountToSupply);

    totalSupplyReal += __amountToSupply;
    availableCapital += _amount;
  }

  function _scaledBalance(address _account, uint256 _premiumSpent)
    internal
    view
    returns (uint256)
  {
    uint256 __liquidityIndex = _liquidityIndex(
      totalSupplyReal,
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
        _liquidityIndex(totalSupplyReal, availableCapital + _premiumSpent)
      )
    );
    //Thao@TODO: il faut voir quand retirer de totalSupplyReal
  }

  // function _burnTotalSupplyWithClaimAmount(
  //   uint256 _amountToRemoveByClaim,
  //   uint256 _availableCapital,
  //   uint256 _premiumSpent
  // ) internal {
  //   totalSupplyReal -= _amountToRemoveByClaim.rayMul(
  //     _liquidityIndex(totalSupplyReal, _availableCapital + _premiumSpent)
  //   );
  // }
}
