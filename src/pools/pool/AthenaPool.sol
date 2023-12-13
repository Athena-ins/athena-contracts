// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Libs
import { RayMath } from "../../libs/RayMath.sol";
import { Tick } from "../../libs/Tick.sol";
import { TickBitmap } from "../../libs/TickBitmap.sol";
import { PremiumPosition } from "../../libs/PremiumPosition.sol";
// Interfaces
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IProtocolPool } from "../../interfaces/IProtocolPool.sol";
import { IAthena } from "../../interfaces/IAthena.sol";
import { IPolicyManager } from "../../interfaces/IPolicyManager.sol";
import { IPolicyCover } from "../../interfaces/IPolicyCover.sol";

contract ProtocolPool is IProtocolPool, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  address public positionManager;

  address public underlyingAsset;
  uint128 public poolId;
  uint128 public commitDelay;

  // @bw unused
  mapping(uint256 => uint256) public withdrawReserves;
  mapping(uint256 => LPInfo) public LPsInfo;

  constructor(
    address core_,
    address positionManager_,
    address underlyingAsset_,
    uint128 poolId_,
    uint128 commitDelay_,
    uint256 uOptimal_,
    uint256 r0_,
    uint256 rSlope1_,
    uint256 rSlope2_
  ) PolicyCover(core_, uOptimal_, r0_, rSlope1_, rSlope2_) {
    positionManager = positionManager_;
    underlyingAsset = underlyingAsset_;
    poolId = poolId_;
    commitDelay = commitDelay_;
    relatedProtocols.push(poolId_);
    intersectingAmounts.push();
  }

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  event TakeInterest(
    uint256 tokenId,
    uint256 userCapital,
    uint256 rewardsGross,
    uint256 rewardsNet,
    uint256 fee
  );

  event WithdrawLiquidity(
    uint256 tokenId,
    uint256 capital,
    uint256 rewardsGross,
    uint256 rewardsNet,
    uint256 fee
  );

  /// =========================== ///
  /// ========= MODIFIER ======== ///
  /// =========================== ///

  modifier onlyCore() {
    require(msg.sender == core, "PP: only Core");
    _;
  }

  modifier onlyPositionManager() {
    require(
      msg.sender == positionManager,
      "PP: Only Position Manager"
    );
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function getRelatedProtocols()
    external
    view
    override
    returns (uint128[] memory)
  {
    return relatedProtocols;
  }

  function protocolInfo()
    external
    view
    returns (
      uint256 insuredCapital,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate,
      Formula memory computingConfig
    )
  {
    uint256 __uRate = _utilisationRate(
      0,
      0,
      slot0.totalInsuredCapital,
      availableLiquidity
    );

    return (
      slot0.totalInsuredCapital,
      availableLiquidity - slot0.totalInsuredCapital,
      __uRate,
      getPremiumRate(__uRate),
      f
    );
  }

  function rewardsOf(
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _poolIds,
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

    ) = _actualizingLPInfoWithClaims(
      tokenId_,
      _userCapital,
      _poolIds
    );

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

  function ratioWithAvailableLiquidity(
    uint256 _amount
  ) external view returns (uint256) {
    return _amount.rayDiv(availableLiquidity);
  }

  /// ========================== ///
  /// ========= HELPERS ======== ///
  /// ========================== ///

  // @bw high gas consumpton - only place saved claims are consummed
  function _actualizingLPInfoWithClaims(
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _poolIds
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
        __claim.liquidityIndexBeforeClaim -
          __newLPInfo.beginLiquidityIndex
      );

      for (uint256 j = 0; j < _poolIds.length; j++) {
        if (_poolIds[j] == __claim.fromPoolId) {
          uint256 capitalToRemove = __newUserCapital.rayMul(
            __claim.ratio
          );

          __aaveScaledBalanceToRemove += capitalToRemove.rayDiv(
            __claim.aaveReserveNormalizedIncomeBeforeClaim
          );

          __newUserCapital = __newUserCapital - capitalToRemove;
          break;
        }
      }
      __newLPInfo.beginLiquidityIndex = __claim
        .liquidityIndexBeforeClaim;
    }
    __newLPInfo.beginClaimIndex += __claims.length;
  }

  /// =================================== ///
  /// ========= CAPITAL PROVIDER ======== ///
  /// =================================== ///

  /// -------- DEPOSIT -------- ///

  function depositToPool(
    uint256 tokenId_,
    uint256 amount_
  ) external onlyPositionManager {
    // Add deposit to pool's own intersecting amounts
    intersectingAmounts[0] += amount_;

    _updateSlot0WhenAvailableLiquidityChange(amount_, 0);
    availableLiquidity += amount_;
    LPsInfo[tokenId_] = LPInfo(
      liquidityIndex,
      processedClaims.length
    );
  }

  /// -------- TAKE INTERESTS -------- ///

  function takePoolInterests(
    address account_,
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _poolIds,
    uint256 _feeRate
  ) public onlyPositionManager returns (uint256, uint256) {
    (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __aaveScaledBalanceToRemove
    ) = _actualizingLPInfoWithClaims(
        tokenId_,
        _userCapital,
        _poolIds
      );

    uint256 __liquidityIndex = liquidityIndex;

    __totalRewards += __newUserCapital.rayMul(
      __liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    __newLPInfo.beginLiquidityIndex = __liquidityIndex;

    // transfer to account:
    uint256 __interestNet = (__totalRewards * (1000 - _feeRate)) /
      1000;
    // @bw here should safe to position instead of initiating transfer when called for fee update
    IERC20(underlyingAsset).safeTransfer(account_, __interestNet);

    // transfer to treasury
    // @bw FEE WARN! core has no way of using funds
    IERC20(underlyingAsset).safeTransfer(
      core,
      __totalRewards - __interestNet
    );

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

  /// -------- WITHDRAW -------- ///

  function withdrawLiquidity(
    address account_,
    uint256 tokenId_,
    uint256 _userCapital,
    uint128[] calldata _poolIds,
    uint128 _feeRate
  ) external override onlyCore returns (uint256, uint256) {
    require(
      _utilisationRate(
        0,
        0,
        slot0.totalInsuredCapital,
        availableLiquidity - _userCapital
      ) <= RayMath.RAY * 100,
      "PP: use rate > 100%"
    );

    (
      // The initial capital impacted by the claims
      uint256 __newUserCapital,
      // The rewards earned through premiums
      uint256 __totalRewards,
      LPInfo memory __newLPInfo,
      uint256 __aaveScaledBalanceToRemove
    ) = _actualizingLPInfoWithClaims(
        tokenId_,
        _userCapital,
        _poolIds
      );

    // Add investment strategy rewards
    __totalRewards += __newUserCapital.rayMul(
      liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    // Remove protocol fees from rewards
    uint256 __rewardsNet;
    if (__totalRewards > 0) {
      __rewardsNet = (__totalRewards * (1000 - _feeRate)) / 1000;
      IERC20(underlyingAsset).safeTransfer(account_, __rewardsNet);
      // @bw FEES are sent to core here
      IERC20(underlyingAsset).safeTransfer(
        core,
        __totalRewards - __rewardsNet
      );
    }

    _updateSlot0WhenAvailableLiquidityChange(0, __newUserCapital);

    for (uint256 i = 0; i < _poolIds.length; i++) {
      intersectingAmounts[
        intersectingAmountIndexes[_poolIds[i]]
      ] -= __newUserCapital;
    }

    availableLiquidity -= __newUserCapital;

    emit WithdrawLiquidity(
      tokenId_,
      __newUserCapital,
      __totalRewards,
      __rewardsNet,
      __totalRewards - __rewardsNet
    );

    delete LPsInfo[tokenId_];

    return (__newUserCapital, __aaveScaledBalanceToRemove);
  }

  /// ========================= ///
  /// ========= COVERS ======== ///
  /// ========================= ///

  /// -------- BUY -------- ///

  function buyPolicy(
    address owner,
    uint256 coverId,
    uint256 premiums,
    uint256 amountCovered
  ) external onlyCore {
    _buyPolicy(coverId, premiums, amountCovered);

    // @bw event should be moved to policy manager
    emit BuyPolicy(owner, premiums, amountCovered);
  }

  /// -------- UPDATE -------- ///

  function increaseCover(
    uint256 coverId_,
    uint256 amount_
  ) external onlyCore {
    // The insured amount is already updated in the Cover Manager
    uint256 newInsuredAmount = policyManagerInterface
      .coverAmountOfPolicy(coverId_);
    // The insured amount is already updated in the Cover Manager
    uint256 oldInsuredAmount = newInsuredAmount - amount_;
    uint256 premiumsLeft = _withdrawPolicy(
      coverId_,
      oldInsuredAmount
    );
    _buyPolicy(coverId_, premiumsLeft, newInsuredAmount);
  }

  function decreaseCover(
    uint256 coverId_,
    uint256 amount_
  ) external onlyCore {
    // The insured amount is already updated in the Cover Manager
    uint256 newInsuredAmount = policyManagerInterface
      .coverAmountOfPolicy(coverId_);
    uint256 oldInsuredAmount = newInsuredAmount + amount_;
    uint256 premiumsLeft = _withdrawPolicy(
      coverId_,
      oldInsuredAmount
    );
    _buyPolicy(coverId_, premiumsLeft, newInsuredAmount);
  }

  function addPremiums(
    uint256 coverId_,
    uint256 amount_
  ) external onlyCore {
    uint256 amountInsured = policyManagerInterface
      .coverAmountOfPolicy(coverId_);
    uint256 premiumsLeft = _withdrawPolicy(coverId_, amountInsured);
    uint256 newPremiumsAmount = premiumsLeft + amount_;
    _buyPolicy(coverId_, newPremiumsAmount, amountInsured);
  }

  function removePremiums(
    uint256 coverId_,
    uint256 amount_,
    address account_
  ) external onlyCore {
    uint256 amountInsured = policyManagerInterface
      .coverAmountOfPolicy(coverId_);
    uint256 premiumsLeft = _withdrawPolicy(coverId_, amountInsured);
    uint256 newPremiumsAmount = premiumsLeft - amount_;
    _buyPolicy(coverId_, newPremiumsAmount, amountInsured);
    IERC20(underlyingAsset).safeTransfer(account_, amount_);
  }

  /// -------- CLOSE -------- ///

  function withdrawPolicy(
    address owner,
    uint256 coverId,
    uint256 amountCovered
  ) external onlyCore {
    uint256 coverPremiumsLeft = _withdrawPolicy(
      coverId,
      amountCovered
    );

    IERC20(underlyingAsset).safeTransfer(owner, coverPremiumsLeft);

    emit WithdrawPolicy(coverId, coverPremiumsLeft);
  }

  /// ========================= ///
  /// ========= CLAIMS ======== ///
  /// ========================= ///

  function processClaim(
    uint128 _fromPoolId,
    uint256 _ratio,
    uint256 _aaveReserveNormalizedIncome
  ) public override onlyCore {
    // @dev Here is where the intersectingAmounts are consumed
    // @bw this is where pool overlaps are used to compute the amount of liq to remove from each pool
    uint256 __amountToRemoveByClaim =intersectingAmounts[intersectingAmountIndexes[_fromPoolId]].rayMul(_ratio)

    _updateSlot0WhenAvailableLiquidityChange(
      0,
      __amountToRemoveByClaim
    );

    availableLiquidity -= __amountToRemoveByClaim;
    intersectingAmounts[
      intersectingAmountIndexes[_fromPoolId]
    ] -= __amountToRemoveByClaim;

    // @bw this should be shared by all pools to avoid multiple storage
    processedClaims.push(
      Claim(
        _fromPoolId,
        _ratio,
        liquidityIndex,
        _aaveReserveNormalizedIncome
      )
    );
  }

  /// ======================== ///
  /// ========= ADMIN ======== ///
  /// ======================== ///

  function actualizing()
    external
    onlyCore
    returns (uint256[] memory)
  {
    return _actualizing();
  }

  // @bw why not updated on withdraw ?
  // @bw seems it is updated on withdraw & claim consumption
  function addRelatedProtocol(
    uint128 relatedPoolId,
    uint256 _amount
  ) external onlyPositionManager {
    if (
      intersectingAmountIndexes[relatedPoolId] == 0 &&
      relatedPoolId != poolId
    ) {
      intersectingAmountIndexes[relatedPoolId] = intersectingAmounts
        .length;

      relatedProtocols.push(relatedPoolId);
      intersectingAmounts.push();
    }

    intersectingAmounts[
      intersectingAmountIndexes[relatedPoolId]
    ] += _amount;
  }
}

abstract contract PolicyCover is IPolicyCover, ClaimCover {
  using RayMath for uint256;
  using Tick for mapping(uint32 => uint256[]);
  using TickBitmap for mapping(uint24 => uint256);
  using PremiumPosition for mapping(uint256 => PremiumPosition.Info);

  address internal immutable core;
  IPolicyManager public policyManagerInterface;
  mapping(uint24 => uint256) internal tickBitmap;
  // Maps a tick to the list of cover IDs
  mapping(uint32 => uint256[]) internal ticks;
  // Maps a cover ID to the premium position of the cover
  mapping(uint256 => PremiumPosition.Info) public premiumPositions;

  Formula internal f;
  Slot0 public slot0;

  constructor(
    address _core,
    uint256 _uOptimal, //Ray
    uint256 _r0, //Ray
    uint256 _rSlope1, //Ray
    uint256 _rSlope2 //Ray
  ) {
    core = _core;
    address coverManagerAddress = IAthena(_core).coverManager();
    if (coverManagerAddress == address(0))
      revert CoreIsUninitialized();
    policyManagerInterface = IPolicyManager(coverManagerAddress);

    f = Formula({
      uOptimal: _uOptimal,
      r0: _r0,
      rSlope1: _rSlope1,
      rSlope2: _rSlope2
    });

    slot0.secondsPerTick = 86400;
    slot0.lastUpdateTimestamp = block.timestamp;
  }

  /// ========================= ///
  /// ========= ERRORS ======== ///
  /// ========================= ///

  error CoreIsUninitialized();

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function actualizingUntilGivenDate(
    uint256 _dateInSeconds
  )
    public
    view
    returns (Slot0 memory __slot0, uint256 __liquidityIndex)
  {
    require(
      _dateInSeconds >= slot0.lastUpdateTimestamp,
      "date is not valide"
    );

    if (slot0.remainingPolicies > 0) {
      (__slot0, __liquidityIndex) = _actualizingUntil(_dateInSeconds);
    } else {
      __slot0 = slot0;
      __slot0.lastUpdateTimestamp = _dateInSeconds;
    }
  }

  function getInfo(
    uint256 coverId_
  )
    public
    view
    returns (
      uint256 __premiumLeft,
      uint256 __currentEmissionRate,
      uint256 __remainingSeconds
    )
  {
    uint256 __availableLiquidity = availableLiquidity;
    (Slot0 memory __slot0, ) = _actualizingUntil(block.timestamp);
    PremiumPosition.Info memory __position = premiumPositions[
      coverId_
    ];

    if (__position.lastTick < __slot0.tick) {
      /// @dev If the tick in slot0 is greater than the position's last tick then the policy is expired
      __premiumLeft = 0;
      __currentEmissionRate = 0;
      __remainingSeconds = 0;
    } else {
      uint256 __coverBeginEmissionRate = policyManagerInterface
        .policy(coverId_)
        .amountCovered
        .rayMul(__position.beginPremiumRate / 100) / 365;

      uint256 __currentPremiumRate = getPremiumRate(
        _utilisationRate(
          0,
          0,
          __slot0.totalInsuredCapital,
          __availableLiquidity
        )
      );

      __currentEmissionRate = getEmissionRate(
        __coverBeginEmissionRate,
        __position.beginPremiumRate,
        __currentPremiumRate
      );

      uint256 __coverCurrentEmissionRate = __currentEmissionRate;

      while (__slot0.tick < __position.lastTick) {
        (uint32 __tickNext, bool __initialized) = tickBitmap
          .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

        uint32 __tick = __tickNext < __position.lastTick
          ? __tickNext
          : __position.lastTick;
        uint256 __secondsPassed = (__tick - __slot0.tick) *
          __slot0.secondsPerTick;

        __premiumLeft +=
          (__secondsPassed * __coverCurrentEmissionRate) /
          86400;

        __remainingSeconds += __secondsPassed;

        __slot0.tick = __tick;

        if (__initialized && __tickNext < __position.lastTick) {
          crossingInitializedTick(
            __slot0,
            __availableLiquidity,
            __tickNext
          );

          __currentPremiumRate = getPremiumRate(
            _utilisationRate(
              0,
              0,
              __slot0.totalInsuredCapital,
              __availableLiquidity
            )
          );

          __coverCurrentEmissionRate = getEmissionRate(
            __coverBeginEmissionRate,
            __position.beginPremiumRate,
            __currentPremiumRate
          );
        }
      }
    }
  }

  function getCurrentPremiumRate() public view returns (uint256) {
    return
      getPremiumRate(
        _utilisationRate(
          0,
          0,
          slot0.totalInsuredCapital,
          availableLiquidity
        )
      );
  }

  /// ================================= ///
  /// ========= INTERNAL VIEWS ======== ///
  /// ================================= ///

  function getEmissionRate(
    uint256 _oldEmissionRate,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) internal pure returns (uint256) {
    return
      _oldEmissionRate.rayMul(_newPremiumRate).rayDiv(
        _oldPremiumRate
      );
  }

  function getSecondsPerTick(
    uint256 _oldSecondsPerTick,
    uint256 _oldPremiumRate,
    uint256 _newPremiumRate
  ) private pure returns (uint256) {
    return
      _oldSecondsPerTick.rayMul(_oldPremiumRate).rayDiv(
        _newPremiumRate
      );
  }

  function durationSecondsUnit(
    uint256 _premium,
    uint256 _insuredCapital,
    uint256 _premiumRate //Ray
  ) private pure returns (uint256) {
    //31536000 * 100 = (365 * 24 * 60 * 60) * 100 // total seconds per year * 100
    return
      ((_premium * 3153600000) / _insuredCapital).rayDiv(
        _premiumRate
      );
  }

  function getPremiumRate(
    uint256 _utilisationRate
  ) internal view returns (uint256) {
    // returns actual rate for insurance
    if (_utilisationRate < f.uOptimal) {
      return
        f.r0 + f.rSlope1.rayMul(_utilisationRate.rayDiv(f.uOptimal));
    } else {
      return
        f.r0 +
        f.rSlope1 +
        (f.rSlope2 * (_utilisationRate - f.uOptimal)) /
        (100 * RayMath.RAY - f.uOptimal) /
        100;
    }
  }

  function crossingInitializedTick(
    Slot0 memory _slot0,
    uint256 _availableLiquidity,
    uint32 _tick
  ) internal view {
    uint256[] memory coverIds = ticks[_tick];
    uint256 __insuredCapitalToRemove;

    for (uint256 i = 0; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];

      __insuredCapitalToRemove += policyManagerInterface
        .policy(coverId)
        .amountCovered;
    }

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        _slot0.totalInsuredCapital,
        _availableLiquidity
      )
    );

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        __insuredCapitalToRemove,
        _slot0.totalInsuredCapital,
        _availableLiquidity
      )
    );

    _slot0.secondsPerTick = getSecondsPerTick(
      _slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    _slot0.totalInsuredCapital -= __insuredCapitalToRemove;
    _slot0.remainingPolicies -= coverIds.length;
  }

  function _actualizingUntil(
    uint256 _dateInSeconds
  )
    internal
    view
    returns (Slot0 memory __slot0, uint256 __liquidityIndex)
  {
    __slot0 = Slot0({
      tick: slot0.tick,
      secondsPerTick: slot0.secondsPerTick,
      totalInsuredCapital: slot0.totalInsuredCapital,
      remainingPolicies: slot0.remainingPolicies,
      lastUpdateTimestamp: slot0.lastUpdateTimestamp
    });

    __liquidityIndex = liquidityIndex;

    uint256 __availableLiquidity = availableLiquidity;
    uint256 __secondsGap = _dateInSeconds -
      __slot0.lastUpdateTimestamp;

    uint256 __uRate = _utilisationRate(
      0,
      0,
      __slot0.totalInsuredCapital,
      __availableLiquidity
    ) / 100;

    uint256 __pRate = getPremiumRate(__uRate * 100) / 100;

    while (__secondsGap > 0) {
      (uint32 __tickNext, bool __initialized) = tickBitmap
        .nextInitializedTickInTheRightWithinOneWord(__slot0.tick);

      uint256 __secondsStep = (__tickNext - __slot0.tick) *
        __slot0.secondsPerTick;

      if (__secondsStep <= __secondsGap) {
        __slot0.tick = __tickNext;
        __liquidityIndex +=
          (__uRate.rayMul(__pRate) * __secondsStep) /
          31536000;
        __secondsGap -= __secondsStep;

        if (__initialized) {
          crossingInitializedTick(
            __slot0,
            __availableLiquidity,
            __tickNext
          );

          __uRate =
            _utilisationRate(
              0,
              0,
              __slot0.totalInsuredCapital,
              __availableLiquidity
            ) /
            100;

          __pRate = getPremiumRate(__uRate * 100) / 100;
        }
      } else {
        __slot0.tick += uint32(__secondsGap / __slot0.secondsPerTick);
        __liquidityIndex +=
          (__uRate.rayMul(__pRate) * __secondsGap) /
          31536000;
        __secondsGap = 0;
      }
    }

    __slot0.lastUpdateTimestamp = _dateInSeconds;
  }

  /// ========================== ///
  /// ========= HELPERS ======== ///
  /// ========================== ///

  function addPremiumPosition(
    uint256 _tokenId,
    uint256 _beginPremiumRate,
    uint32 _tick
  ) private {
    uint224 nbCoversInTick = ticks.addCoverId(_tokenId, _tick);

    premiumPositions[_tokenId] = PremiumPosition.Info(
      _beginPremiumRate,
      _tick,
      nbCoversInTick
    );

    if (!tickBitmap.isInitializedTick(_tick)) {
      tickBitmap.flipTick(_tick);
    }
  }

  function removeTick(
    uint32 _tick
  ) private returns (uint256[] memory coverIds) {
    coverIds = ticks[_tick];

    for (uint256 i = 0; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];
      delete premiumPositions[coverId];

      emit ExpiredPolicy(coverId, _tick);
    }

    ticks.clear(_tick);
    tickBitmap.flipTick(_tick);
  }

  function _updateSlot0WhenAvailableLiquidityChange(
    uint256 _amountToAdd,
    uint256 _amountToRemove
  ) internal {
    uint256 __availableLiquidity = availableLiquidity;
    uint256 __totalInsuredCapital = slot0.totalInsuredCapital;

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        __totalInsuredCapital,
        __availableLiquidity
      )
    );

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        __totalInsuredCapital,
        __availableLiquidity + _amountToAdd - _amountToRemove
      )
    );

    slot0.secondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );
  }

  function _actualizing() internal returns (uint256[] memory) {
    if (slot0.remainingPolicies > 0) {
      (
        Slot0 memory __slot0,
        uint256 __liquidityIndex
      ) = _actualizingUntil(block.timestamp);

      //now, we remove all crossed ticks
      uint256[] memory __expiredPoliciesTokens = new uint256[](
        slot0.remainingPolicies - __slot0.remainingPolicies
      );
      uint256 __expiredPoliciesTokenIdCurrentIndex;

      uint32 __observedTick = slot0.tick;
      bool __initialized;
      while (__observedTick < __slot0.tick) {
        (__observedTick, __initialized) = tickBitmap
          .nextInitializedTickInTheRightWithinOneWord(__observedTick);

        if (__initialized && __observedTick <= __slot0.tick) {
          uint256[]
            memory __currentExpiredPoliciesTokenId = removeTick(
              __observedTick
            );

          for (
            uint256 i = 0;
            i < __currentExpiredPoliciesTokenId.length;
            i++
          ) {
            __expiredPoliciesTokens[
              __expiredPoliciesTokenIdCurrentIndex
            ] = __currentExpiredPoliciesTokenId[i];

            __expiredPoliciesTokenIdCurrentIndex++;
          }
        }
      }

      slot0.tick = __slot0.tick;
      slot0.secondsPerTick = __slot0.secondsPerTick;
      slot0.totalInsuredCapital = __slot0.totalInsuredCapital;
      slot0.remainingPolicies = __slot0.remainingPolicies;
      slot0.lastUpdateTimestamp = block.timestamp;
      liquidityIndex = __liquidityIndex;

      return __expiredPoliciesTokens;
    }

    slot0.lastUpdateTimestamp = block.timestamp;
    return new uint256[](0);
  }

  /// ========================= ///
  /// ========= COVERS ======== ///
  /// ========================= ///

  /// -------- BUY -------- ///

  function _buyPolicy(
    uint256 _tokenId,
    uint256 _premium,
    uint256 _insuredCapital
  ) internal {
    uint256 _availableLiquidity = availableLiquidity;
    uint256 totalInsuredCapital = slot0.totalInsuredCapital;

    require(
      totalInsuredCapital + _insuredCapital < _availableLiquidity,
      "Insufficient capital"
    );

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(0, 0, totalInsuredCapital, _availableLiquidity)
    );

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        _insuredCapital,
        0,
        totalInsuredCapital,
        _availableLiquidity
      )
    );

    uint256 __durationInSeconds = durationSecondsUnit(
      _premium,
      _insuredCapital,
      __newPremiumRate
    );

    uint256 __newSecondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    require(
      __durationInSeconds >= __newSecondsPerTick,
      "Min duration"
    );

    uint32 __lastTick = slot0.tick +
      uint32(__durationInSeconds / __newSecondsPerTick);

    addPremiumPosition(_tokenId, __newPremiumRate, __lastTick);

    slot0.totalInsuredCapital += _insuredCapital;
    slot0.secondsPerTick = __newSecondsPerTick;

    slot0.remainingPolicies++;
  }

  /// -------- CLOSE -------- ///

  function _withdrawPolicy(
    uint256 coverId,
    uint256 _amountCovered
  ) internal returns (uint256 __remainedPremium) {
    PremiumPosition.Info memory __position = premiumPositions[
      coverId
    ];
    uint32 __currentTick = slot0.tick;

    require(__currentTick <= __position.lastTick, "Policy Expired");

    uint256 __totalInsuredCapital = slot0.totalInsuredCapital;
    uint256 __availableLiquidity = availableLiquidity;

    uint256 __currentPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        0,
        __totalInsuredCapital,
        __availableLiquidity
      )
    );

    uint256 __ownerCurrentEmissionRate = getEmissionRate(
      _amountCovered.rayMul(__position.beginPremiumRate / 100) / 365,
      __position.beginPremiumRate,
      __currentPremiumRate
    );

    __remainedPremium =
      ((__position.lastTick - __currentTick) *
        slot0.secondsPerTick *
        __ownerCurrentEmissionRate) /
      86400;

    uint256 __newPremiumRate = getPremiumRate(
      _utilisationRate(
        0,
        _amountCovered,
        __totalInsuredCapital,
        __availableLiquidity
      )
    );

    slot0.totalInsuredCapital -= _amountCovered;

    slot0.secondsPerTick = getSecondsPerTick(
      slot0.secondsPerTick,
      __currentPremiumRate,
      __newPremiumRate
    );

    if (ticks.getCoverIdNumber(__position.lastTick) > 1) {
      premiumPositions.replaceAndRemoveCoverId(
        coverId,
        ticks.getLastCoverIdInTick(__position.lastTick)
      );

      ticks.removeCoverId(
        __position.coverIdIndex,
        __position.lastTick
      );
    } else {
      removeTick(__position.lastTick);
    }

    slot0.remainingPolicies--;
  }
}

abstract contract ClaimCover is LiquidityCover {
  using RayMath for uint256;

  struct Claim {
    uint128 fromPoolId;
    uint256 ratio; // Ray //ratio = claimAmount / capital
    uint256 liquidityIndexBeforeClaim;
    uint256 aaveReserveNormalizedIncomeBeforeClaim;
  }

  Claim[] public processedClaims;

  // @bw Thao@NOTE: for testing
  // function claimsCount() public view returns (uint256) {
  //   return processedClaims.length;
  // }

  function _claims(
    uint256 beginIndex
  ) internal view returns (Claim[] memory) {
    uint256 __length = processedClaims.length;
    if (__length == beginIndex) return new Claim[](0);

    __length = __length - beginIndex;
    Claim[] memory __claims = new Claim[](__length);
    for (uint256 i = 0; i < __length; i++) {
      __claims[i] = processedClaims[beginIndex + i];
    }

    return __claims;
  }
}

abstract contract LiquidityCover {
  using RayMath for uint256;

  uint128[] public relatedProtocols;

  // @bw This could probably be replace by a poolId -> amount mapping
  // Maps poolId -> overlapped capital amount
  mapping(uint128 => uint256) public intersectingAmountIndexes;
  uint256[] public intersectingAmounts;

  uint256 public availableLiquidity;

  uint256 public liquidityIndex;

  function updateLiquidityIndex(
    uint256 _uRate,
    uint256 _pRate,
    uint256 _deltaT
  ) internal {
    liquidityIndex += (_uRate.rayMul(_pRate) * _deltaT) / 31536000;
  }

  // returns actual usage rate on capital insured / capital provided for insurance
  function _utilisationRate(
    uint256 _insuredCapitalToAdd,
    uint256 _insuredCapitalToRemove,
    uint256 _totalInsuredCapital,
    uint256 _availableLiquidity
  ) internal pure returns (uint256) {
    if (_availableLiquidity == 0) {
      return 0;
    }
    uint256 utilizationRate = (((_totalInsuredCapital +
      _insuredCapitalToAdd) - _insuredCapitalToRemove) * 100).rayDiv(
        _availableLiquidity
      );

    //  @bw problem if usage is above 100% (ex: 100$ insured and 1$ capital)
    // In this case the usage should be ajusted to reflect available capital
    // The ratio should be slightly favorable for liquidity provider to incentivise equilibrium
    // Special rules for +100% -> adapt uRate to be based on capital + bonus to incentivize provider
    // 100% = 100 1e27 (rays)

    return utilizationRate;
  }
}
