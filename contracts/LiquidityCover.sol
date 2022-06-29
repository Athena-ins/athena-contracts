// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./libraries/RayMath.sol";

abstract contract LiquidityCover is ERC20 {
  using RayMath for uint256;

  event Mint(address owner, uint256 amount);

  //Thao@ADD: nous avons besoin pour ajouter des claims dans d'autre protocols compatifs
  uint128[] public compatibilityProtocols;

  //ce même protocol est à l'indice 0 mais il faut enlever pour gas
  mapping(uint128 => uint256) public intersectingAmountIndexes;
  uint256[] public intersectingAmounts;

  uint256 public availableCapital;

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

  //Thao@TODO:
  // - il faut une fct 'burn' pour retirer de totalSupply afin de recalculer liquidité index
  // - pour ça, il faut garder supply d'un LP
}
