// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";

import "hardhat/console.sol";

//Thao@NOTE:
// tout les contrats: liquidityCover, ClaimCover et PolicyCover ne implémentent que la logique.
// ProtocolPool assemble les logiques et les checks: onlyCore, ...
contract ProtocolPool is IProtocolPool, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  address private immutable core;
  address public underlyingAsset;
  //Thao@NOTE: ajouter id pour traiter des claims;
  uint128 public id;

  mapping(address => uint256) public withdrawReserves;
  mapping(address => uint256) public lastActionsTimestamp;

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

  function committingWithdraw(address _account) external onlyCore {
    //Thao@TODO: require have any claim in progress
    withdrawReserves[_account] = block.timestamp;
  }

  function removeCommittedWithdraw(address _account) external {
    delete withdrawReserves[_account];
  }

  function mint(address _account, uint256 _amount) external onlyCore {
    actualizing();
    uint256 __amount = RayMath.otherToRay(_amount);

    _mint(
      _account,
      (
        __amount.rayMul(
          getLiquidityIndex(
            totalSupply(),
            availableCapital + slot0.premiumSpent
          )
        )
      )
    );

    availableCapital += __amount;
    //Thao@TODO: event
  }

  //Thao@Dev: cette fct utilise à intérieur du contrat
  //tout les public ou external fct va convertir Ray en decimal et inversement
  //@param _userCapital est en Ray
  //@return __redeem est en Ray et 100%
  //Thao@NOTE: il faut changer le nom de fct
  function _rewardsOf(
    address _account,
    uint256 _userCapital,
    uint256 _dateInSecond
  ) internal view returns (int256) {
    (
      Slot0 memory __slot0,
      uint256 __availableCapital,
      Claim[] memory __claims
    ) = actualizingSlot0WithClaims(_dateInSecond);
    //Thao@TODO: il faut parcourir __claims et recalculer totalSupply et liquidityIndex dans chaque interval entre deux claims
    //Thao@TODO: il faut trouver comment recalculer totalSupply car plusieurs LP concerner par un claim
    //il faut faire une boucle ici
    //check aussi id de protocol dans claim pour retirer amount de LP concerné
    uint256 __liquidityIndex = getLiquidityIndex(
      totalSupply(),
      __availableCapital + __slot0.premiumSpent
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
        availableCapital - __userCapital
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
    }

    //Thao@TODO: à VERIFIER ici jusqu'à la fin
    availableCapital -= uint256(int256(__userCapital) + __difference);

    //@Dev TODO check for gas when large amount of claims and when/if needed to clean
    for (uint256 i = 0; i < claims.length; i++) {
      if (claims[i].createdAt > _accountTimestamp) {
        __userCapital -= claims[i].ratio * __userCapital;
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

  function releaseFunds(address _account, uint256 _amount)
    external
    override
    onlyCore
  {
    // Slot0 memory __slot0 = actualizingSlot0WithClaims(block.timestamp);
    // if (_amount > __slot0.premiumSpent) {
    // release funds from AAVE TO REFUND USER
    // }
    actualizing();
    addClaim(
      Claim(
        id,
        RayMath.otherToRay(_amount),
        RayMath.otherToRay(_amount).rayDiv(availableCapital),
        block.timestamp,
        0,
        0
      )
    );

    console.log("Amount to refund : ", _amount);
    uint256 bal = IERC20(underlyingAsset).balanceOf(address(this));
    console.log("Balance Contract = ", bal);
    console.log("Account to transfer = ", _account);
    IERC20(underlyingAsset).safeTransfer(_account, _amount);
    availableCapital -= RayMath.otherToRay(_amount);
    //Thao@TODO: recalculer slot0 car availableCapital est changé
  }
}
