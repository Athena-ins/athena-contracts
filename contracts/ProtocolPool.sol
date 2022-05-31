// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";
import "./libraries/WadRayMath.sol";
import "hardhat/console.sol";

contract ProtocolPool is IProtocolPool, ERC20, PolicyCover {
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
    actualizing();
    _mint(_account, (_amount.rayMul(liquidityIndex)).rayDiv(RAY));
    availableCapital += _amount;
    updateLiquidityIndex();
  }

  function updateLiquidityIndex() internal override {
    uint256 _totalSupply = totalSupply();
    if (_totalSupply == 0) {
      liquidityIndex = RAY;
    } else
      liquidityIndex = (_totalSupply).rayDiv(availableCapital + totalInsured);
  }

  function withdraw(
    address _account,
    uint256 _userCapital,
    uint128 _discount
  ) external onlyCore {
    // liquidity index is * 1E18
    uint256 _redeem = rewardsOf(_account, _userCapital);
    // console.log("Redeem : ", _redeem);
    _burn(_account, balanceOf(_account));
    if (_redeem > 0) {
      // sub fees depending on aten staking
      IERC20(underlyingAsset).safeTransfer(
        _account,
        (_redeem * (1000 - _discount)) / 1000
      );
      _transferToTreasury((_redeem * _discount) / 1000);
    }
    totalInsured -= _redeem;
    availableCapital -= _userCapital;
    updateLiquidityIndex();
  }

  function rewardsOf(address _account, uint256 _userCapital)
    public
    view
    returns (uint256 _redeem)
  {
    uint256 _amount = balanceOf(_account);
    uint256 _scaledBalance = (_amount).rayDiv(liquidityIndex);
    // console.log("User : ", _account);
    // console.log("Protocol : ", name());
    // console.log("Liquidity Index : ", liquidityIndex);
    // console.log("Amount balance : ", _amount);
    // console.log("Amount balance scaled : ", (_amount).rayDiv(liquidityIndex));
    // console.log("User Capital : ", _userCapital);
    if (_scaledBalance > _userCapital) {
      _redeem = _scaledBalance - _userCapital;
    } else {
      _redeem = 0;
    }
  }

  function claim(address _account, uint256 _userCapital) external onlyCore {
    uint256 _redeem = rewardsOf(_account, _userCapital);

    if (_redeem > 0) {
      // sub fees depending on aten staking
      IERC20(underlyingAsset).safeTransfer(_account, _redeem);
      // _transferToTreasury(_redeem);
    }
    // availableCapital -= _userCapital;
    totalInsured -= _redeem;
    // burn some tokens to reflect capital with no rewards
    _burn(_account, _redeem.rayDiv(liquidityIndex));
    updateLiquidityIndex();
  }

  function _transferToTreasury(uint256 _amount) internal {
    IERC20(underlyingAsset).safeTransfer(core, _amount);
  }
}
