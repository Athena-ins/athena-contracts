// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";

contract ProtocolPool is IProtocolPool, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  address public underlyingAsset;
  uint128 public id;
  string public _poolName;
  uint256 public immutable commitDelay;

  mapping(uint256 => uint256) public withdrawReserves;
  mapping(uint256 => LPInfo) public LPsInfo;

  constructor(
    address _core,
    address _underlyingAsset,
    uint128 _id,
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2,
    string memory poolName_,
    uint256 _commitDelay
  ) PolicyCover(_core, _uOptimal, _r0, _rSlope1, _rSlope2) {
    underlyingAsset = _underlyingAsset;
    commitDelay = _commitDelay;
    id = _id;
    _poolName = poolName_;
    relatedProtocols.push(_id);
    // intersectingAmountIndexes[_id] = 0;
    intersectingAmounts.push();
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function poolName() public view returns (string memory) {
    return _poolName;
  }

  function getRelatedProtocols()
    external
    view
    override
    returns (uint128[] memory)
  {
    return relatedProtocols;
  }

  function addRelatedProtocol(uint128 _protocolId, uint256 _amount)
    external
  // onlyCore
  {
    if (intersectingAmountIndexes[_protocolId] == 0 && _protocolId != id) {
      intersectingAmountIndexes[_protocolId] = intersectingAmounts.length;

      relatedProtocols.push(_protocolId);

      intersectingAmounts.push();
    }

    intersectingAmounts[intersectingAmountIndexes[_protocolId]] += _amount;
  }

  function committingWithdrawLiquidity(uint256 tokenId_) external onlyCore {
    withdrawReserves[tokenId_] = block.timestamp;
  }

  function removeCommittedWithdrawLiquidity(uint256 tokenId_)
    external
    onlyCore
  {
    delete withdrawReserves[tokenId_];
  }

  function removeLPInfo(uint256 tokenId_) external onlyCore {
    delete LPsInfo[tokenId_];
  }

  function deposit(
    uint256 tokenId_,
    uint256 amount_ // @bw onlyCore or onlyPositionManager ?
  ) external {
    // Add deposit to pool's own intersecting amounts
    intersectingAmounts[0] += amount_;

    _updateSlot0WhenAvailableCapitalChange(amount_, 0);
    availableCapital += amount_;
    LPsInfo[tokenId_] = LPInfo(liquidityIndex, processedClaims.length);
  }

  function buyPolicy(
    address _owner,
    uint256 _tokenId,
    uint256 _premium,
    uint256 _insuredCapital
  ) external onlyCore notExistedOwner(_owner) {
    _buyPolicy(_owner, _tokenId, _premium, _insuredCapital);

    emit BuyPolicy(_owner, _premium, _insuredCapital);
  }

  function withdrawPolicy(address _owner, uint256 _amountCovered)
    external
    onlyCore
    existedOwner(_owner)
    returns (uint256 __remainedPremium)
  {
    __remainedPremium = _withdrawPolicy(_owner, _amountCovered);

    IERC20(underlyingAsset).safeTransfer(_owner, __remainedPremium);

    emit WithdrawPolicy(_owner, __remainedPremium);
  }

  function _actualizingLPInfoWithClaims(
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _protocolIds
  )
    internal
    view
    returns (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __aaveScaledBalanceToRemove
    )
  {
    __newLPInfo = LPsInfo[tokenId_];
    Claim[] memory __claims = _claims(__newLPInfo.beginClaimIndex);

    __newUserCapital = _userCapital;

    for (uint256 i = 0; i < __claims.length; i++) {
      Claim memory __claim = __claims[i];

      __totalRewards += __newUserCapital.rayMul(
        __claim.liquidityIndexBeforeClaim - __newLPInfo.beginLiquidityIndex
      );

      for (uint256 j = 0; j < _protocolIds.length; j++) {
        if (_protocolIds[j] == __claim.fromProtocolId) {
          uint256 capitalToRemove = __newUserCapital.rayMul(__claim.ratio);

          __aaveScaledBalanceToRemove += capitalToRemove.rayDiv(
            __claim.aaveReserveNormalizedIncomeBeforeClaim
          );

          __newUserCapital = __newUserCapital - capitalToRemove;
          break;
        }
      }

      __newLPInfo.beginLiquidityIndex = __claim.liquidityIndexBeforeClaim;
    }

    __newLPInfo.beginClaimIndex += __claims.length;
  }

  function rewardsOf(
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _feeRate,
    uint256 _dateInSecond
  )
    public
    view
    override
    returns (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo
    )
  {
    (
      __newUserCapital,
      __totalRewards,
      __newLPInfo,

    ) = _actualizingLPInfoWithClaims(tokenId_, _userCapital, _protocolIds);

    uint256 __liquidityIndex;

    if (slot0.remainingPolicies > 0) {
      (, __liquidityIndex) = _actualizingUntil(_dateInSecond);
    } else {
      __liquidityIndex = liquidityIndex;
    }

    __totalRewards += __newUserCapital.rayMul(
      __liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    __totalRewards = (__totalRewards * (1000 - _feeRate)) / 1000;

    __newLPInfo.beginLiquidityIndex = __liquidityIndex;
  }

  event TakeInterest(
    uint256 tokenId,
    uint256 userCapital,
    uint256 rewardsGross,
    uint256 rewardsNet,
    uint256 fee
  );

  //onlyPositionManager
  function takeInterest(
    address account_,
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _feeRate
  ) public returns (uint256, uint256) {
    (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __aaveScaledBalanceToRemove
    ) = _actualizingLPInfoWithClaims(tokenId_, _userCapital, _protocolIds);

    uint256 __liquidityIndex = liquidityIndex;

    __totalRewards += __newUserCapital.rayMul(
      __liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    __newLPInfo.beginLiquidityIndex = __liquidityIndex;

    //transfer to account:
    uint256 __interestNet = (__totalRewards * (1000 - _feeRate)) / 1000;
    IERC20(underlyingAsset).safeTransfer(account_, __interestNet);

    //transfer to treasury
    IERC20(underlyingAsset).safeTransfer(core, __totalRewards - __interestNet);

    LPsInfo[tokenId_] = __newLPInfo;

    emit TakeInterest(
      tokenId_,
      __newUserCapital,
      __totalRewards,
      __interestNet,
      __totalRewards - __interestNet
    );

    return (__newUserCapital, __aaveScaledBalanceToRemove);
  }

  function isWithdrawLiquidityDelayOk(uint256 tokenId_)
    external
    view
    returns (bool)
  {
    uint256 withdrawReserveTime = withdrawReserves[tokenId_];
    return
      withdrawReserveTime != 0 &&
      block.timestamp - withdrawReserveTime >= commitDelay;
  }

  event WithdrawLiquidity(
    uint256 tokenId,
    uint256 capital,
    uint256 rewardsGross,
    uint256 rewardsNet,
    uint256 fee
  );

  function withdrawLiquidity(
    address account_,
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint128 _feeRate
  ) external override onlyCore returns (uint256, uint256) {
    require(
      _utilisationRate(
        0,
        0,
        slot0.totalInsuredCapital,
        availableCapital - _userCapital
      ) <= RayMath.RAY * 100,
      string(abi.encodePacked(poolName(), ": use rate > 100%"))
    );

    (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __aaveScaledBalanceToRemove
    ) = _actualizingLPInfoWithClaims(tokenId_, _userCapital, _protocolIds);

    __totalRewards += __newUserCapital.rayMul(
      liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    uint256 __rewardsNet;
    if (__totalRewards > 0) {
      __rewardsNet = (__totalRewards * (1000 - _feeRate)) / 1000;
      IERC20(underlyingAsset).safeTransfer(account_, __rewardsNet);
      IERC20(underlyingAsset).safeTransfer(core, __totalRewards - __rewardsNet);
    }

    _updateSlot0WhenAvailableCapitalChange(0, __newUserCapital);

    for (uint256 i = 0; i < _protocolIds.length; i++) {
      intersectingAmounts[
        intersectingAmountIndexes[_protocolIds[i]]
      ] -= __newUserCapital;
    }

    availableCapital -= __newUserCapital;

    emit WithdrawLiquidity(
      tokenId_,
      __newUserCapital,
      __totalRewards,
      __rewardsNet,
      __totalRewards - __rewardsNet
    );

    return (__newUserCapital, __aaveScaledBalanceToRemove);
  }

  // @bw DANGER should not be public
  function processClaim(
    uint128 _fromProtocolId,
    uint256 _ratio,
    uint256 _aaveReserveNormalizedIncome
  ) public override {
    uint256 __amountToRemoveByClaim = _amountToRemoveFromIntersecAndCapital(
      _intersectingAmount(_fromProtocolId),
      _ratio
    );
    _updateSlot0WhenAvailableCapitalChange(0, __amountToRemoveByClaim);
    availableCapital -= __amountToRemoveByClaim;
    intersectingAmounts[
      intersectingAmountIndexes[_fromProtocolId]
    ] -= __amountToRemoveByClaim;
    processedClaims.push(
      Claim(
        _fromProtocolId,
        _ratio,
        liquidityIndex,
        _aaveReserveNormalizedIncome
      )
    );
  }

  function ratioWithAvailableCapital(uint256 _amount)
    external
    view
    returns (uint256)
  {
    return _amount.rayDiv(availableCapital);
  }

  //onlyCore?
  function actualizing() external returns (uint256[] memory) {
    return _actualizing();
  }

  function protocolInfo()
    external
    view
    returns (
      string memory name,
      uint256 insuredCapital,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate
    )
  {
    uint256 __uRate = _utilisationRate(
      0,
      0,
      slot0.totalInsuredCapital,
      availableCapital
    );

    return (
      poolName(),
      slot0.totalInsuredCapital,
      availableCapital - slot0.totalInsuredCapital,
      __uRate,
      getPremiumRate(__uRate)
    );
  }
}
