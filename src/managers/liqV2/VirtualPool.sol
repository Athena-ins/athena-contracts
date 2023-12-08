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

  struct VPool {
    Formula f;
    Slot0 slot0;
    uint256 availableCapital;
    uint256 liquidityIndex;
    address underlyingAsset; // @bw to be replaced by strat id
    bool isPaused;
    mapping(uint128 _poolId => uint256 _amount) overlaps;
    uint128[] overlappedPools;
    mapping(uint256 => LPInfo _lpInfo) lpInfos;
    mapping(uint24 => uint256) tickBitmap;
    // Maps a tick to the list of cover IDs
    mapping(uint32 _tick => uint256[] _coverIds) ticks;
    // Maps a cover ID to the premium position of the cover
    mapping(uint256 _coverId => PremiumPosition.Info _premiumsInfo) premiumPositions;
  }

  // ======= VIRTUAL CONSTRUCTOR ======= //

  function vPoolConstructor(
    VPool storage self,
    address underlyingAsset_,
    uint256 uOptimal_, //Ray
    uint256 r0_, //Ray
    uint256 rSlope1_, //Ray
    uint256 rSlope2_ //Ray
  ) internal {
    if (underlyingAsset_ == address(0)) {
      revert ZeroAddressAsset();
    }

    self.f = Formula({
      uOptimal: uOptimal_,
      r0: r0_,
      rSlope1: rSlope1_,
      rSlope2: rSlope2_
    });

    self.underlyingAsset = underlyingAsset_;

    self.slot0.secondsPerTick = 86400;
    self.slot0.lastUpdateTimestamp = block.timestamp;
  }
}
