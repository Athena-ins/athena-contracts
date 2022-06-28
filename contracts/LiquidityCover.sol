// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./libraries/RayMath.sol";

abstract contract LiquidityCover is ERC20 {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  mapping(uint128 => uint256) public intersectingAmounts;
  //Thao@ADD:
  uint128[] public compatibilityProtocols;

  uint256 public availableCapital;

  function addIntersectingAmount(
    uint256 _amount,
    uint128 _protocolId,
    bool _isAdded
  ) external {
    intersectingAmounts[_protocolId] = _isAdded
      ? intersectingAmounts[_protocolId] + _amount
      : intersectingAmounts[_protocolId] - _amount;
  }

  function getIntersectingAmountRatio(
    uint128 _protocolId,
    uint256 _availableCapital
  ) external view returns (uint256) {
    return intersectingAmounts[_protocolId].rayDiv(_availableCapital);
  }

  function getLiquidityIndex(uint256 _totalSupply, uint256 _totalCapital)
    internal
    pure
    returns (uint256)
  {
    return _totalSupply == 0 ? RayMath.RAY : _totalSupply.rayDiv(_totalCapital);
  }

  function mintLiquidity(
    address _account,
    uint256 _amount,
    uint256 _premiumSpent
  ) external {
    _mint(
      _account,
      (
        _amount.rayMul(
          getLiquidityIndex(totalSupply(), availableCapital + _premiumSpent)
        )
      )
    );

    availableCapital += _amount;
    //Thao@TODO: event
  }

  function getScaledBalance(address _account, uint256 _premiumSpent)
    internal
    view
    returns (uint256)
  {
    uint256 __liquidityIndex = getLiquidityIndex(
      totalSupply(),
      availableCapital + _premiumSpent
    );

    return balanceOf(_account).rayDiv(__liquidityIndex);
  }

  //Thao@TODO:
  // - il faut une fct 'burn' pour retirer de totalSupply afin de recalculer liquidité index
  // - pour ça, il faut garder supply d'un LP
}
