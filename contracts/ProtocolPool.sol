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
  uint256 public immutable commitDelay;

  mapping(address => uint256) public withdrawReserves;
  mapping(address => uint256) public beginIndexClaims;

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
    string memory _symbol,
    uint256 _commitDelay
  ) ERC20(_name, _symbol) PolicyCover(_uOptimal, _r0, _rSlope1, _rSlope2) {
    core = _core;
    underlyingAsset = _underlyingAsset;
    commitDelay = _commitDelay;
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
    _mintLiquidity(_account, _amount);
    emit Mint(_account, _amount);
  }

  function buyPolicy(
    address _owner,
    uint256 _premium,
    uint256 _insuredCapital
  ) external onlyCore notExistedOwner(_owner) {
    _actualizing();
    _buyPolicy(_owner, _premium, _insuredCapital);
    emit BuyPolicy(_owner, _premium, _insuredCapital);
  }

  function withdrawPolicy(address _owner)
    external
    onlyCore
    existedOwner(_owner)
  {
    _actualizing();
    uint256 __remainedPremium = _withdrawPolicy(_owner);
    emit WithdrawPolicy(_owner, __remainedPremium);
  }

  function actualizingTest() external {
    _actualizing();
  }

  function _rewardsOf(
    address _account,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _dateInSecond
  ) public view returns (uint256 __userCapital, uint256 __totalRewards) {
    __userCapital = _userCapital;
    //si il n'y a pas de claim, __balance est le début quand _account deposit
    //sinon __balance est déjà màj après des claims passés
    uint256 __balance = balanceOf(_account);
    Claim[] memory __claims = _claims(beginIndexClaims[_account]);

    for (uint256 i = 0; i < __claims.length; i++) {
      Claim memory __claim = __claims[i];

      // uint256 __liquidityIndex = _liquidityIndex(
      //   __claim.totalSupplyRealBefore,
      //   __claim.availableCapitalBefore + __claim.currentPremiumSpentBefore
      // );
      // uint256 __scaledBalance = __balance.rayDiv(__liquidityIndex);
      // uint256 __currentRewards = __scaledBalance - __balance;
      // __totalRewards += __currentRewards;

      // for (uint256 j = 0; j < _protocolIds.length; j++) {
      //   if (_protocolIds[j] == __claim.fromProtocolId) {
      //     uint256 __userCapitalToRemove = __userCapital.rayMul(__claim.ratio);
      //     __userCapital -= __userCapitalToRemove;
      //     break;
      //   }
      // }

      // __balance = __userCapital + __currentRewards;
    }

    // beginIndexClaims[_account] += __claims.length;

    if (slot0.remainingPolicies > 0) {
      (Slot0 memory __slot0, ) = _actualizingUntil(_dateInSecond);
    }
  }

  function rewardsOf(
    address _account,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _discount
  ) public view returns (uint256) {
    (, uint256 __totalRewards) = _rewardsOf(
      _account,
      _userCapital,
      _protocolIds,
      block.timestamp
    );

    return (__totalRewards * (1000 - _discount)) / 1000;
  }

  //Thao@TODO: il faut voir si withdraw doit enregistrer pour calcul ???
  function withdrawLiquidity(
    address _account,
    uint256 _userCapital,
    uint128 _discount,
    uint256 _accountTimestamp
  ) external override onlyCore returns (uint256) {
    uint256 __userCapital = _userCapital;

    require(
      withdrawReserves[_account] != 0 &&
        block.timestamp - withdrawReserves[_account] >= commitDelay,
      "withdraw reserve"
    );

    require(
      _utilisationRate(
        0,
        0,
        slot0.totalInsuredCapital,
        availableCapital - __userCapital
      ) <= RayMath.otherToRay(100),
      string(abi.encodePacked(name(), ": use rate > 100%"))
    );

    // int256 __difference = _rewardsOf(_account, __userCapital, block.timestamp);

    // _burn(_account, balanceOf(_account));
    // if (__difference > 0) {
    //   IERC20(underlyingAsset).safeTransfer(
    //     _account,
    //     RayMath.rayToOther((uint256(__difference) * (1000 - _discount)) / 1000)
    //   );

    //   _transferToTreasury(
    //     RayMath.rayToOther((uint256(__difference) * _discount) / 1000)
    //   );
    // }

    // //Thao@TODO: à VERIFIER ici jusqu'à la fin
    // availableCapital -= uint256(int256(__userCapital) + __difference);

    // //@Dev TODO check for gas when large amount of claims and when/if needed to clean
    // for (uint256 i = 0; i < claims.length; i++) {
    //   if (claims[i].createdAt > _accountTimestamp) {
    //     __userCapital -= claims[i].ratio * __userCapital;
    //   }
    // }

    // return (
    //   __difference > 0
    //     ? (_userCapital + uint256(__difference))
    //     : (_userCapital - uint256(-__difference))
    // );
  }

  function _transferToTreasury(uint256 _amount) internal {
    IERC20(underlyingAsset).safeTransfer(core, _amount);
  }

  //TODO: this fct is actualy not used
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
        _amount,
        _amount.rayDiv(availableCapital),
        liquidityIndex,
        block.timestamp
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
    return
      Claim(
        id,
        _amount,
        _amount.rayDiv(availableCapital),
        liquidityIndex,
        block.timestamp
      );
  }

  //releaseFunds calls this fct for updating protocol pool
  function addClaim(Claim memory _claim) external override {
    _actualizing();

    // uint256 __availableCapital = availableCapital;

    //we don't need this condition because we use only 30% of availableCapital
    // require(__availableCapital > _claim.amount, "Capital not enought");

    //compute capital, slot0 and intersectingAmount with claim:
    uint256 __amountToRemoveByClaim = _amountToRemoveFromIntersecAndCapital(
      _intersectingAmount(_claim.fromProtocolId),
      _claim.ratio
    );

    _updateSlot0WithClaimAmount(__amountToRemoveByClaim);
    _removeAmountFromAvailableCapital(__amountToRemoveByClaim);
    // _setTotalSupplyReal((__availableCapital - __amountToRemoveByClaim));
    _removeIntersectingAmount(_claim.fromProtocolId, __amountToRemoveByClaim);

    _addClaim(_claim);
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

    _addIntersectingAmount(_protocolId, _amount);
  }
}
