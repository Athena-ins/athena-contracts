// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Parents
import { PolicyCover } from "../cover/PolicyCover.sol";
// Libs
import { RayMath } from "../libs/RayMath.sol";
// Interfaces
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IProtocolPool } from "../interface/IProtocolPool.sol";

contract ProtocolPool is IProtocolPool, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  address public positionManager;

  address public underlyingAsset;
  uint128 public poolId;
  uint128 public commitDelay;

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
    require(msg.sender == positionManager, "PP: Only Position Manager");
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
      availableCapital
    );

    return (
      slot0.totalInsuredCapital,
      availableCapital - slot0.totalInsuredCapital,
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

    ) = _actualizingLPInfoWithClaims(tokenId_, _userCapital, _poolIds);

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

  function ratioWithAvailableCapital(
    uint256 _amount
  ) external view returns (uint256) {
    return _amount.rayDiv(availableCapital);
  }

  /// ========================== ///
  /// ========= HELPERS ======== ///
  /// ========================== ///

  function _getAmountInsuredByCover(
    uint256 coverId_
  ) internal view returns (uint256) {
    return policyManagerInterface.coverAmountOfPolicy(coverId_);
  }

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
        __claim.liquidityIndexBeforeClaim - __newLPInfo.beginLiquidityIndex
      );

      for (uint256 j = 0; j < _poolIds.length; j++) {
        if (_poolIds[j] == __claim.fromPoolId) {
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

    _updateSlot0WhenAvailableCapitalChange(amount_, 0);
    availableCapital += amount_;
    LPsInfo[tokenId_] = LPInfo(liquidityIndex, processedClaims.length);
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
    ) = _actualizingLPInfoWithClaims(tokenId_, _userCapital, _poolIds);

    uint256 __liquidityIndex = liquidityIndex;

    __totalRewards += __newUserCapital.rayMul(
      __liquidityIndex - __newLPInfo.beginLiquidityIndex
    );

    __newLPInfo.beginLiquidityIndex = __liquidityIndex;

    // transfer to account:
    uint256 __interestNet = (__totalRewards * (1000 - _feeRate)) / 1000;
    IERC20(underlyingAsset).safeTransfer(account_, __interestNet);

    // transfer to treasury
    // @bw FEE WARN! core has no way of using funds
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
        availableCapital - _userCapital
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
    ) = _actualizingLPInfoWithClaims(tokenId_, _userCapital, _poolIds);

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
      IERC20(underlyingAsset).safeTransfer(core, __totalRewards - __rewardsNet);
    }

    _updateSlot0WhenAvailableCapitalChange(0, __newUserCapital);

    for (uint256 i = 0; i < _poolIds.length; i++) {
      intersectingAmounts[
        intersectingAmountIndexes[_poolIds[i]]
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

  function increaseCover(uint256 coverId_, uint256 amount_) external onlyCore {
    // The insured amount is already updated in the Cover Manager
    uint256 newInsuredAmount = _getAmountInsuredByCover(coverId_);
    _increaseCover(coverId_, amount_, newInsuredAmount);
  }

  function decreaseCover(uint256 coverId_, uint256 amount_) external onlyCore {
    // The insured amount is already updated in the Cover Manager
    uint256 newInsuredAmount = _getAmountInsuredByCover(coverId_);
    _decreaseCover(coverId_, amount_, newInsuredAmount);
  }

  function addPremiums(uint256 coverId_, uint256 amount_) external onlyCore {
    uint256 amountInsured = _getAmountInsuredByCover(coverId_);
    _addPremiums(coverId_, amount_, amountInsured);
  }

  function removePremiums(
    uint256 coverId_,
    uint256 amount_,
    address account_
  ) external onlyCore {
    uint256 amountInsured = _getAmountInsuredByCover(coverId_);
    _removePremiums(coverId_, amount_, amountInsured);
    IERC20(underlyingAsset).safeTransfer(account_, amount_);
  }

  /// -------- CLOSE -------- ///

  function withdrawPolicy(
    address owner,
    uint256 coverId,
    uint256 amountCovered
  ) external onlyCore {
    uint256 coverPremiumsLeft = _withdrawPolicy(coverId, amountCovered);

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
    uint256 __amountToRemoveByClaim = _amountToRemoveFromIntersecAndCapital(
      intersectingAmounts[intersectingAmountIndexes[_fromPoolId]],
      _ratio
    );
    _updateSlot0WhenAvailableCapitalChange(0, __amountToRemoveByClaim);

    availableCapital -= __amountToRemoveByClaim;
    intersectingAmounts[
      intersectingAmountIndexes[_fromPoolId]
    ] -= __amountToRemoveByClaim;

    processedClaims.push(
      Claim(_fromPoolId, _ratio, liquidityIndex, _aaveReserveNormalizedIncome)
    );
  }

  /// ======================== ///
  /// ========= ADMIN ======== ///
  /// ======================== ///

  function actualizing() external onlyCore returns (uint256[] memory) {
    return _actualizing();
  }

  // @bw why not updated on withdraw ?
  // @bw seems it is updated on withdraw & claim consumption
  function addRelatedProtocol(
    uint128 relatedPoolId,
    uint256 _amount
  ) external onlyPositionManager {
    if (
      intersectingAmountIndexes[relatedPoolId] == 0 && relatedPoolId != poolId
    ) {
      intersectingAmountIndexes[relatedPoolId] = intersectingAmounts.length;

      relatedProtocols.push(relatedPoolId);
      intersectingAmounts.push();
    }

    intersectingAmounts[intersectingAmountIndexes[relatedPoolId]] += _amount;
  }
}
