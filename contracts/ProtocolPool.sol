// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";
import "hardhat/console.sol";

contract ProtocolPool is IProtocolPool, ERC20, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  address private immutable core;
  uint256 private liquidityIndex = RayMath.RAY;

  // @Dev notice rule
  // external and public functions should use Decimals and convert to RAY, other functions should already use RAY
  // external function onlyCore convert afterwards to user public view functions

  //@dev constructs Pool LP Tokens, decimals defaults to 18
  constructor(
    address _core,
    address _underlyingAsset,
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2,
    string memory _name,
    string memory _symbol
  )
    ERC20(_name, _symbol)
    PolicyCover(_underlyingAsset, _uOptimal, _r0, _rSlope1, _rSlope2)
  {
    core = _core;
  }

  modifier onlyCore() override {
    require(msg.sender == core, "Only Core");
    _;
  }

  function mint(address _account, uint256 _amount) external onlyCore {
    actualizing();
    _mint(_account, (_amount.rayMul(liquidityIndex)));
    slot0.availableCapital += _amount;
    updateLiquidityIndex();
  }

  function updateLiquidityIndex() internal {
    uint256 _totalSupply = RayMath.RAY * totalSupply();
    if (_totalSupply == 0) {
      liquidityIndex = RayMath.RAY;
    } else
      liquidityIndex = (_totalSupply).rayDiv(
        slot0.availableCapital + slot0.totalInsuredCapital
      );
  }

  function withdraw(
    address _account,
    uint256 _userCapital,
    uint128 _discount
  ) external onlyCore {
    // liquidity index is * 1E18
    uint256 _redeem = rewardsOf(_account, _userCapital);
    _burn(_account, balanceOf(_account));
    if (_redeem > 0) {
      // sub fees depending on aten staking
      IERC20(underlyingAsset).safeTransfer(
        _account,
        (_redeem * (1000 - _discount)) / 1000
      );
      _transferToTreasury((_redeem * _discount) / 1000);
    }
    slot0.totalInsuredCapital -= _redeem;
    slot0.availableCapital -= _userCapital;
    updateLiquidityIndex();
  }

  function rewardsOf(address _account, uint256 _userCapital)
    public
    view
    returns (uint256 _redeem)
  {
    uint256 __amount = RayMath.RAY * balanceOf(_account);
    uint256 __totalSupply = RayMath.RAY * (totalSupply());

    Slot0 memory __slot0 = actualizingUntilGivenDate(block.timestamp);
    uint256 __liquidityIndex = __totalSupply == 0
      ? RayMath.RAY
      : (__totalSupply).rayDiv(
        __slot0.availableCapital + __slot0.totalInsuredCapital
      );

    uint256 _scaledBalance = (__amount).rayDiv(__liquidityIndex) / RayMath.RAY;
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
    slot0.totalInsuredCapital -= _redeem;
    // burn some tokens to reflect capital with no rewards
    _burn(_account, _redeem.rayDiv(liquidityIndex));
    updateLiquidityIndex();
  }

  function _transferToTreasury(uint256 _amount) internal {
    IERC20(underlyingAsset).safeTransfer(core, _amount);
  }

  function releaseFunds(address _account, uint256 _amount)
    external
    override
    onlyCore
  {
    Slot0 memory __slot0 = actualizingUntilGivenDate(block.timestamp);
    // if (_amount > __slot0.premiumSpent) {
    // release funds from AAVE TO REFUND USER
    // }
    console.log("Amount to refund : ", _amount);
    uint256 bal = IERC20(underlyingAsset).balanceOf(address(this));
    console.log("Balance Contract = ", bal);
    console.log("Account to transfer = ", _account);
    IERC20(underlyingAsset).safeTransfer(_account, _amount);
    // slot0.premiumSpent -= _amount;
    actualizing();
  }
}
