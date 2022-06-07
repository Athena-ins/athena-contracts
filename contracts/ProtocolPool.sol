// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";
import "hardhat/console.sol";

contract ProtocolPool is IProtocolPool, ERC20, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  address private immutable core;
  mapping(address => uint256) private withdrawReserves;

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

  function getLiquidityIndex(uint256 _totalSupply, uint256 _totalCapital)
    internal
    pure
    returns (uint256)
  {
    return _totalSupply == 0 ? RayMath.RAY : _totalSupply.rayDiv(_totalCapital);
  }

  function mint(address _account, uint256 _amount) external onlyCore {
    uint256 __amount = RayMath.otherToRay(_amount);

    actualizing();

    console.log("ProtocolPool:<<_account:", _account);
    console.log("ProtocolPool:>>totalSupply():", totalSupply());

    _mint(
      _account,
      (
        __amount.rayMul(
          getLiquidityIndex(totalSupply(), slot0.availableCapital)
        )
      )
    );

    console.log("ProtocolPool:>>totalSupply():", totalSupply());

    slot0.availableCapital += __amount;
  }

  function commitWithdraw(address _account) external onlyCore {
    withdrawReserves[_account] = block.timestamp;
  }

  //Thao@WARN: ce n'est pas bon car rewardsOf renvoie que les rewards, pas total amount
  function withdraw(
    address _account,
    uint256 _userCapital,
    uint128 _discount
  ) external onlyCore {
    //Thao@TODO: require commitday > 14 and useRate <= 100%
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

    slot0.availableCapital -= RayMath.otherToRay(_userCapital + _redeem);
  }

  //Thao@Question: doit on retirer 10% dans __redeem
  function rewardsOf(address _account, uint256 _userCapital)
    public
    view
    returns (uint256 __redeem)
  {
    uint256 __userCapital = RayMath.otherToRay(_userCapital);
    uint256 __amount = balanceOf(_account);
    uint256 __totalSupply = totalSupply();

    Slot0 memory __slot0 = actualizingUntilGivenDate(block.timestamp);
    uint256 __liquidityIndex = getLiquidityIndex(
      __totalSupply,
      __slot0.availableCapital
    );

    uint256 __scaledBalance = (__amount).rayDiv(__liquidityIndex);

    console.log("ProtocolPool.rewardsOf:<<block.timestamp:", block.timestamp);
    console.log("ProtocolPool.rewardsOf:<<_userCapital:", _userCapital);
    console.log("ProtocolPool.rewardsOf:>>__userCapital:", __userCapital);
    console.log("ProtocolPool.rewardsOf:>>__amount:", __amount);
    console.log("ProtocolPool.rewardsOf:>>__totalSupply:", __totalSupply);
    console.log(
      "ProtocolPool.rewardsOf:>>__slot0.availableCapital:",
      __slot0.availableCapital
    );
    console.log("ProtocolPool.rewardsOf:>>__liquidityIndex:", __liquidityIndex);
    console.log("ProtocolPool.rewardsOf:>>__scaledBalance:", __scaledBalance);
    console.log(
      "ProtocolPool.rewardsOf:>>__scaledBalance > __userCapital:",
      __scaledBalance > __userCapital
    );

    if (__scaledBalance > __userCapital) {
      __redeem = RayMath.rayToOther(__scaledBalance - __userCapital);
    } else {
      __redeem = 0;
    }
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
