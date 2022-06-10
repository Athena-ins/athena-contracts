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
  address public underlyingAsset;

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
  ) ERC20(_name, _symbol) PolicyCover(_uOptimal, _r0, _rSlope1, _rSlope2) {
    core = _core;
    underlyingAsset = _underlyingAsset;
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
    actualizing();
    uint256 __amount = RayMath.otherToRay(_amount);

    // console.log("ProtocolPool.mint <<< _account:", _account);
    // console.log("ProtocolPool.mint >>> totalSupply():", totalSupply());

    _mint(
      _account,
      (
        __amount.rayMul(
          getLiquidityIndex(totalSupply(), slot0.availableCapital)
        )
      )
    );

    // console.log("ProtocolPool.mint >>> totalSupply():", totalSupply());

    slot0.availableCapital += __amount;
  }

  //Thao@Dev: cette fct utilise à intérieur du contrat
  //tout les public ou external fct va convertir Ray en decimal et inversement
  //@param _useCapital est en Ray
  //@return __redeem est en Ray et 100%
  function _rewardsOf(
    address _account,
    uint256 _userCapital,
    uint256 _dateInSecond
  ) internal view returns (uint256 __redeem) {
    Slot0 memory __slot0 = actualizingUntilGivenDate(_dateInSecond);
    uint256 __liquidityIndex = getLiquidityIndex(
      totalSupply(),
      __slot0.availableCapital
    );

    uint256 __scaledBalance = balanceOf(_account).rayDiv(__liquidityIndex);

    // console.log("ProtocolPool._rewardsOf <<< _dateInSecond:", _dateInSecond);
    // console.log("ProtocolPool._rewardsOf <<< _userCapital:", _userCapital);
    // console.log("ProtocolPool._rewardsOf >>> __amount:", balanceOf(_account));
    // console.log("ProtocolPool._rewardsOf >>> __totalSupply:", totalSupply());
    // console.log(
    //   "ProtocolPool._rewardsOf >>> __slot0.availableCapital:",
    //   __slot0.availableCapital
    // );
    // console.log(
    //   "ProtocolPool._rewardsOf >>> __liquidityIndex:",
    //   __liquidityIndex
    // );
    // console.log(
    //   "ProtocolPool._rewardsOf >>> __scaledBalance:",
    //   __scaledBalance
    // );
    // console.log(
    //   "ProtocolPool._rewardsOf >>> __scaledBalance > _userCapital:",
    //   __scaledBalance > _userCapital
    // );

    if (__scaledBalance > _userCapital) {
      __redeem = __scaledBalance - _userCapital;
    } else {
      __redeem = 0;
    }
  }

  function rewardsOf(
    address _account,
    uint256 _userCapital,
    uint256 _discount
  ) public view returns (uint256 __redeem) {
    __redeem = _rewardsOf(
      _account,
      RayMath.otherToRay(_userCapital),
      block.timestamp
    );

    //Thao@TODO: fees depending on aten staking ?
    __redeem = RayMath.rayToOther((__redeem * (1000 - _discount)) / 1000);
  }

  function commitWithdraw(address _account) external onlyCore {
    withdrawReserves[_account] = block.timestamp;
  }

  function withdraw(
    address _account,
    uint256 _userCapital,
    uint128 _discount
  ) external onlyCore {
    uint256 __userCapital = RayMath.otherToRay(_userCapital);

    console.log("ProtocolPool.withdraw <<< _userCapital:", _userCapital);
    console.log("ProtocolPool.withdraw >>> __userCapital:", __userCapital);
    console.log(
      "ProtocolPool.withdraw >>> slot0.totalInsuredCapital:",
      slot0.totalInsuredCapital
    );
    console.log(
      "ProtocolPool.withdraw >>> slot0.availableCapital:",
      slot0.availableCapital
    );

    require(
      // withdrawReserves[_account] != 0 &&
      block.timestamp - withdrawReserves[_account] >= 14 days,
      "withdraw reserve"
    );

    require(
      getUtilisationRate(
        false,
        0,
        slot0.totalInsuredCapital,
        slot0.availableCapital - __userCapital
      ) <= RayMath.otherToRay(100),
      "use rate > 100%"
    );

    uint256 __redeem = RayMath.rayToOther(
      _rewardsOf(_account, __userCapital, block.timestamp)
    );

    _burn(_account, balanceOf(_account));
    if (__redeem > 0) {
      // sub fees depending on aten staking
      IERC20(underlyingAsset).safeTransfer(
        _account,
        (__redeem * (1000 - _discount)) / 1000
      );
      _transferToTreasury((__redeem * _discount) / 1000);
    }

    // console.log(
    //   "ProtocolPool.withdraw >> slot0.availableCapital:",
    //   slot0.availableCapital
    // );

    // console.log("ProtocolPool.withdraw >> _userCapital:", _userCapital);
    // console.log("ProtocolPool.withdraw >> __redeem:", __redeem);
    // console.log(
    //   "ProtocolPool.withdraw >> _userCapital + __redeem:",
    //   _userCapital + __redeem
    // );
    // console.log(
    //   "ProtocolPool.withdraw >> Ray(_userCapital + __redeem):",
    //   RayMath.otherToRay(_userCapital + __redeem)
    // );
    // console.log(
    //   "ProtocolPool.withdraw >> slot0.availableCapital - Ray(_userCapital + __redeem):",
    //   slot0.availableCapital - RayMath.otherToRay(_userCapital + __redeem)
    // );

    slot0.availableCapital -= __userCapital + __redeem;
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
