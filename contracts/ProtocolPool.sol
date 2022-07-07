// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";

contract ProtocolPool is IProtocolPool, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  address private immutable core;
  address public underlyingAsset;
  uint128 public id;

  mapping(address => uint256) public withdrawReserves;
  mapping(address => uint256) public lastIndexClaims;

  // @Dev notice rule
  // external and public functions should use Decimals and convert to RAY, other functions should already use RAY
  // external function onlyCore convert afterwards to user public view functions

  //@dev constructs Pool LP Tokens, decimals defaults to 18
  constructor(
    address _core,
    address _underlyingAsset,
    uint128 _id,
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2,
    string memory _name,
    string memory _symbol
  ) ERC20(_name, _symbol) PolicyCover(_uOptimal, _r0, _rSlope1, _rSlope2) {
    core = _core;
    underlyingAsset = _underlyingAsset;

    id = _id;
    relatedProtocols.push(_id);
    // intersectingAmountIndexes[_id] = 0;
    intersectingAmounts.push();
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function committingWithdrawLiquidity(address _account) external onlyCore {
    withdrawReserves[_account] = block.timestamp;
  }

  function removeCommittedWithdrawLiquidity(address _account) external {
    delete withdrawReserves[_account];
  }

  function mint(address _account, uint256 _amount) external onlyCore {
    _actualizing();
    _mintLiquidity(_account, RayMath.otherToRay(_amount), slot0.premiumSpent);
    emit Mint(_account, _amount);
  }

  function buyPolicy(
    address _owner,
    uint256 _premium,
    uint256 _insuredCapital
  ) external onlyCore notExistedOwner(_owner) {
    _actualizing();
    _buyPolicy(
      _owner,
      RayMath.otherToRay(_premium),
      RayMath.otherToRay(_insuredCapital)
    );
    emit BuyPolicy(_owner, _premium, _insuredCapital);
  }

  function withdrawPolicy(address _owner)
    external
    onlyCore
    existedOwner(_owner)
  {
    _actualizing();
    uint256 __remainedPremium = _withdrawPolicy(_owner);
    emit WithdrawPolicy(_owner, RayMath.rayToOther(__remainedPremium));
  }

  function actualizingTest() external {
    _actualizing();
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
    //Thao@TODO: il faut diviser en 2 cas:
    // - il y a pas de claim: actualizingSlot0WithInterval()
    // - il y a un claim: _actualizingSlot0WithClaims

    //Thao@TODO: il faut uint256[] memory __intersectingAmounts pour ce calcul ?
    (Slot0 memory __slot0, uint256 __availableCapital) = _actualizingUntil(
      _dateInSecond
    );

    Claim[] memory __claims = _claims();
    //Thao@TODO: il faut parcourir __claims et recalculer totalSupply et liquidityIndex dans chaque interval entre deux claims
    //Thao@TODO: il faut trouver comment recalculer totalSupply car plusieurs LP concerner par un claim
    //il faut faire une boucle ici
    //check aussi id de protocol dans claim pour retirer amount de LP concerné

    //Thao@TODO: i n'est pas tj commencer de 0
    for (uint256 i = 0; i < __claims.length; i++) {
      Claim memory __claim = __claims[i];
      //calcul
      uint256 __liquidityIndex = _liquidityIndex(
        totalSupply(),
        __claim.availableCapitalBefore + __claim.premiumSpentBefore
      );

      uint256 __scaledBalance = balanceOf(_account).rayDiv(__liquidityIndex);
      int256(__scaledBalance) - int256(_userCapital);
    }

    return 0; //TODO
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

    //Thao@TODO: il faut save lastIndexClaims ici
  }

  function withdrawLiquidity(
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
      _utilisationRate(
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
    // Slot0 memory __slot0 = _actualizingSlot0WithClaims(block.timestamp);
    // if (_amount > __slot0.premiumSpent) {
    // release funds from AAVE TO REFUND USER
    // }
    _actualizing();
    _addClaim(
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
  }

  function getRelatedProtocols()
    external
    view
    override
    returns (uint128[] memory)
  {
    return relatedProtocols;
  }

  function buildClaim(uint256 _amount)
    external
    view
    override
    onlyCore
    returns (ClaimCover.Claim memory)
  {
    uint256 __amount = RayMath.otherToRay(_amount);
    return
      Claim(
        id,
        __amount,
        __amount.rayDiv(availableCapital),
        block.timestamp,
        0,
        0
      );
  }

  //releaseFunds calls this fct for updating protocol pool
  function addClaim(Claim memory _claim) external override {
    _actualizing();

    uint256 __availableCapital = availableCapital;

    require(__availableCapital > _claim.amount, "Capital not enought");

    Slot0 memory __slot0 = Slot0({
      tick: slot0.tick,
      premiumRate: slot0.premiumRate,
      emissionRate: slot0.emissionRate,
      hoursPerTick: slot0.hoursPerTick,
      totalInsuredCapital: slot0.totalInsuredCapital,
      premiumSpent: slot0.premiumSpent,
      remainingPolicies: slot0.remainingPolicies,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    // save info in claim
    _claim.availableCapitalBefore = __availableCapital;
    _claim.premiumSpentBefore = __slot0.premiumSpent;

    //compute slot0 and capital with claim:
    uint256 __amountToRemoveByClaim = _amountToRemoveFromIntersecAndCapital(
      _intersectingAmount(_claim.fromProtocolId),
      _claim.ratio
    );

    _updateSlot0WithClaimAmount(_claim.fromProtocolId, __amountToRemoveByClaim);

    _addClaim(_claim);

    {
      // console.log("Protocol:", id);
      // console.log("ProtocolPool.addClaim <<< _account:", _account);
      // console.log(
      //   "ProtocolPool.addClaim <<< _claim.fromProtocolId:",
      //   _claim.fromProtocolId
      // );
      // console.log("ProtocolPool.addClaim <<< _claim.amount:", _claim.amount);
      // console.log("ProtocolPool.addClaim <<< _claim.ratio:", _claim.ratio);
      // console.log(
      //   "ProtocolPool.addClaim <<< _claim.createdAt:",
      //   _claim.createdAt
      // );
    }
  }

  function addRelatedProtocol(uint128 _protocolId, uint256 _amount)
    external
    onlyCore
  {
    if (intersectingAmountIndexes[_protocolId] == 0 && _protocolId != id) {
      intersectingAmountIndexes[_protocolId] = intersectingAmounts.length;

      relatedProtocols.push(_protocolId);

      intersectingAmounts.push();
    }

    _addIntersectingAmount(_protocolId, RayMath.otherToRay(_amount));
  }
}
