// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Libs
import { RayMath } from "../../libs/RayMath.sol";
import { Tick } from "../../libs/Tick.sol";
import { TickBitmap } from "../../libs/TickBitmap.sol";
import { PremiumPosition } from "../../libs/PremiumPosition.sol";
// Interfaces
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ======= ERRORS ======= //

error ZeroAddressAsset();

library VirtualPool {
  using RayMath for uint256;
  using SafeERC20 for IERC20;
  using Tick for mapping(uint32 => uint256[]);
  using TickBitmap for mapping(uint24 => uint256);
  using PremiumPosition for mapping(uint256 => PremiumPosition.Info);

  // ======= VIRTUAL STORAGE ======= //

  struct Formula {
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  struct Slot0 {
    uint32 tick;
    uint256 secondsPerTick;
    uint256 totalInsuredCapital;
    uint256 remainingPolicies;
    uint256 lastUpdateTimestamp;
  }

  struct LPInfo {
    uint256 beginLiquidityIndex;
    uint256 beginClaimIndex;
  }

  struct PoolClaim {
    uint128 fromPoolId;
    uint256 ratio; // Ray //ratio = claimAmount / capital
    uint256 liquidityIndexBeforeClaim;
    uint256 aaveReserveNormalizedIncomeBeforeClaim;
  }

  struct VPool {
    uint128 poolId;
    Formula f;
    Slot0 slot0;
    uint256 liquidityIndex;
    address underlyingAsset; // @bw to be replaced by strat id
    bool isPaused;
    /// @dev poolId 0 -> poolId 0 points to a pool's available liquidity
    /// @dev liquidity overlap is always registered in the lower poolId
    // Maps poolId 0 -> poolId 1 -> overlapping capital
    mapping(uint128 _poolId => uint256 _amount) overlaps;
    uint128[] overlappedPools;
    mapping(uint256 => LPInfo _lpInfo) lpInfos;
    mapping(uint24 => uint256) tickBitmap;
    // Maps a tick to the list of cover IDs
    mapping(uint32 _tick => uint256[] _coverIds) ticks;
    // Maps a cover ID to the premium position of the cover
    mapping(uint256 _coverId => PremiumPosition.Info _premiumsInfo) premiumPositions;
    PoolClaim[] processedClaims; // @bw should change to ids to fetch in map to use storage pointers
  }

  // ======= VIRTUAL CONSTRUCTOR ======= //

  function vPoolConstructor(
    VPool storage self,
    uint128 poolId,
    address underlyingAsset_,
    uint256 uOptimal_, //Ray
    uint256 r0_, //Ray
    uint256 rSlope1_, //Ray
    uint256 rSlope2_ //Ray
  ) internal {
    if (underlyingAsset_ == address(0)) {
      revert ZeroAddressAsset();
    }

    self.poolId = poolId;
    self.underlyingAsset = underlyingAsset_;

    self.f = Formula({
      uOptimal: uOptimal_,
      r0: r0_,
      rSlope1: rSlope1_,
      rSlope2: rSlope2_
    });

    self.slot0.secondsPerTick = 86400;
    self.slot0.lastUpdateTimestamp = block.timestamp;

    self.overlappedPools[0] = poolId;
    self.overlaps[poolId] = 1; // 1 wei

    // @dev for comptabile pools, check that pools are registered both ways for safety
  }

  // ======= READ METHODS ======= //

  // @bw ex: availableCapital
  function availableLiquidity(
    VPool storage self
  ) public view returns (uint256) {
    return self.overlaps[self.poolId];
  }

  function _claims(
    VPool storage self,
    uint256 beginIndex
  ) internal view returns (PoolClaim[] memory) {
    uint256 nbProcessed = self.processedClaims.length;
    if (nbProcessed == beginIndex) return new PoolClaim[](0);

    uint256 toProcess = nbProcessed - beginIndex;
    PoolClaim[] memory claims = new PoolClaim[](toProcess);

    for (uint256 i; i < toProcess; i++) {
      claims[i] = self.processedClaims[beginIndex + i];
    }

    return claims;
  }

  // ======= WRITE METHODS ======= //

  // ======= PURE HELPERS ======= //

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
    Formula storage f,
    uint256 _utilisationRate
  ) internal view returns (uint256) {
    // returns actual rate for insurance
    // @bw case for overusage ?
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

  // returns actual usage rate on capital insured / capital provided for insurance
  function _utilisationRate(
    uint256 _insuredCapitalToAdd,
    uint256 _insuredCapitalToRemove,
    uint256 _totalInsuredCapital,
    uint256 _availableLiquidity
  ) private pure returns (uint256) {
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
