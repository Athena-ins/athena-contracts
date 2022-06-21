// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";
import "hardhat/console.sol";

contract ProtocolPool is IProtocolPool, ERC20, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  struct Claim {
    uint256 createdAt;
    uint256 disputeId;
    uint256 amount;
    uint256 percentage; // RAY
  }

  Claim[] public claims;

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

    _mint(
      _account,
      (
        __amount.rayMul(
          getLiquidityIndex(totalSupply(), slot0.availableCapital)
        )
      )
    );

    slot0.availableCapital += __amount;
    //Thao@TODO: event
  }

  //Thao@Dev: cette fct utilise à intérieur du contrat
  //tout les public ou external fct va convertir Ray en decimal et inversement
  //@param _useCapital est en Ray
  //@return __redeem est en Ray et 100%
  //Thao@NOTE: il faut changer le nom de fct
  function _rewardsOf(
    address _account,
    uint256 _userCapital,
    uint256 _dateInSecond
  ) internal view returns (int256) {
    Slot0 memory __slot0 = actualizingSlot0(_dateInSecond);
    uint256 __liquidityIndex = getLiquidityIndex(
      totalSupply(),
      __slot0.availableCapital
    );

    uint256 __scaledBalance = balanceOf(_account).rayDiv(__liquidityIndex);

    return int256(__scaledBalance) - int256(_userCapital);
  }

  function rewardsOf(
    address _account,
    uint256 _userCapital,
    uint256 _discount
  ) public view returns (int256) {
    int256 __difference = _rewardsOf(
      _account,
      RayMath.otherToRay(_userCapital),
      block.timestamp
    );

    if (__difference < 0) return __difference;
    else
      return
        int256(
          RayMath.rayToOther(
            (uint256(__difference) * (1000 - _discount)) / 1000
          )
        );
  }

  function committingWithdraw(address _account) external onlyCore {
    //Thao@TODO: require have any claim in progress
    withdrawReserves[_account] = block.timestamp;
  }

  function removeCommittedWithdraw(address _account) external onlyCore {
    delete withdrawReserves[_account];
  }

  function withdraw(
    address _account,
    uint256 _userCapital,
    uint128 _discount,
    uint256 _accountTimestamp
  ) external override onlyCore returns (uint256) {
    uint256 __userCapital = RayMath.otherToRay(_userCapital);

    require(
      withdrawReserves[_account] != 0 &&
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
      string(abi.encodePacked(name(), ": use rate > 100%"))
    );

    int256 __difference = _rewardsOf(_account, __userCapital, block.timestamp);

    _burn(_account, balanceOf(_account));
    if (__difference > 0) {
      IERC20(underlyingAsset).safeTransfer(
        _account,
        RayMath.rayToOther((uint256(__difference) * (1000 - _discount)) / 1000)
      );

      _transferToTreasury(
        RayMath.rayToOther((uint256(__difference) * _discount) / 1000)
      );

      slot0.availableCapital -= __userCapital + uint256(__difference);
    } else {
      slot0.availableCapital -= uint256(int256(__userCapital) + __difference);
    }
    //@Dev TODO check for gas when large amount of claims and when/if needed to clean
    for (uint256 i = 0; i < claims.length; i++) {
      if (claims[i].createdAt > _accountTimestamp) {
        _userCapital -= claims[i].percentage * _userCapital;
      }
    }
    return (
      __difference > 0
        ? (_userCapital + uint256(__difference))
        : (_userCapital - uint256(-__difference))
    );
  }

  function _transferToTreasury(uint256 _amount) internal {
    IERC20(underlyingAsset).safeTransfer(core, _amount);
  }

  //THao@TODO: pas sure de marcher comme il faut
  function releaseFunds(address _account, uint256 _amount)
    external
    override
    onlyCore
  {
    // Slot0 memory __slot0 = actualizingSlot0(block.timestamp);
    // if (_amount > __slot0.premiumSpent) {
    // release funds from AAVE TO REFUND USER
    // }
    actualizing();
    claims.push(
      Claim(
        block.timestamp,
        0,
        RayMath.otherToRay(_amount).rayDiv(slot0.availableCapital),
        RayMath.otherToRay(_amount)
      )
    );
    console.log("Amount to refund : ", _amount);
    uint256 bal = IERC20(underlyingAsset).balanceOf(address(this));
    console.log("Balance Contract = ", bal);
    console.log("Account to transfer = ", _account);
    IERC20(underlyingAsset).safeTransfer(_account, _amount);
    slot0.availableCapital -= RayMath.otherToRay(_amount);
    //Thao@TODO: recalculer slot0 car availableCapital est changé
  }
}
