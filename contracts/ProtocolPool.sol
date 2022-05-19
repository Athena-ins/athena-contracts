// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";
import "./libraries/WadRayMath.sol";
import "hardhat/console.sol";

contract ProtocolPool is IProtocolPool, ERC20, Ownable, Pausable, PolicyCover {
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  address private immutable core;
  uint256 internal constant RAY = 1e27;
  uint256 private liquidityIndex = RAY;

  //@dev constructs Pool LP Tokens, decimals defaults to 18
  constructor(
    address _core,
    address _underlyingAsset,
    string memory _name,
    string memory _symbol
  ) ERC20(_name, _symbol) PolicyCover(_underlyingAsset) {
    core = _core;
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function mint(address _account, uint256 _amount) external onlyCore {
    availableCapital += _amount;
    updateLiquidityIndex();
    _mint(_account, (_amount.rayMul(liquidityIndex)).rayDiv(RAY));
  }

  function updateLiquidityIndex() internal override {
    uint256 _totalSupply = totalSupply();
    if (_totalSupply == 0) {
      liquidityIndex = RAY;
    } else
      liquidityIndex = (_totalSupply).rayDiv(availableCapital + premiumSupply);
    console.log("Update liquidity Index : ", liquidityIndex);
  }

  function withdraw(address _account, uint256 _userCapital) external onlyCore {
    uint256 _amount = balanceOf(_account);
    console.log("User : ", _account);
    console.log("Liquidity Index : ", liquidityIndex);
    console.log("Amount balance : ", _amount);
    console.log("Amount balance scaled : ", (_amount).rayDiv(liquidityIndex));
    console.log("User Capital : ", _userCapital);
    // liquidity index is * 1E18
    uint256 _redeem = (_amount).rayDiv(liquidityIndex) - _userCapital;
    console.log("Redeem : ", _redeem);
    _burn(_account, _amount);
    if (_redeem > 0) {
      // sub fees depending on aten staking
      IERC20(underlyingAsset).safeTransfer(_account, _redeem);
    }
    availableCapital -= _userCapital;
    updateLiquidityIndex();
  }

  function claim(address _account, uint256 _userCapital) external onlyCore {
    uint256 _amount = balanceOf(_account);
    uint256 _redeem = (_amount).rayDiv(liquidityIndex) - _userCapital;
    _burn(_account, _redeem);
    if (_redeem > 0) {
      // sub fees depending on aten staking
      IERC20(underlyingAsset).safeTransfer(_account, _redeem);
    }
    // availableCapital -= _userCapital;
    updateLiquidityIndex();
  }
}
