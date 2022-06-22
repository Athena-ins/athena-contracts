// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./libraries/RayMath.sol";

contract LiquidityCover is ERC20 {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  mapping(address => uint256) public withdrawReserves;
  uint256 public availableCapital;

  constructor(string memory _name, string memory _symbol)
    ERC20(_name, _symbol)
  {}

  function committingWithdraw(address _account) external {
    //Thao@TODO: require have any claim in progress
    withdrawReserves[_account] = block.timestamp;
  }

  function removeCommittedWithdraw(address _account) external {
    delete withdrawReserves[_account];
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
}
