// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { Tick } from "../libs/Tick.sol";
import { TickBitmap } from "../libs/TickBitmap.sol";
import { PoolMath } from "../libs/PoolMath.sol";

// Interfaces
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";

library DataTypes {
  struct Slot0 {
    uint32 tick; // The last tick at which the pool's liquidity was updated
    uint256 secondsPerTick; // The distance in seconds between ticks
    uint256 coveredCapital;
    uint256 remainingCovers;
    // The last timestamp at which the current tick changed
    uint256 lastUpdateTimestamp;
    // The index tracking how much premiums have been consumed in favor of LP
    uint256 liquidityIndex;
  }

  struct LpInfo {
    uint256 beginLiquidityIndex;
    uint256 beginClaimIndex;
  }

  struct Cover {
    uint256 coverAmount;
    uint256 beginPremiumRate;
    /**
     * If cover is active: last last tick for which the cover is valid
     * If cover is expired: tick at which the cover was expired minus 1
     */
    uint32 lastTick;
    uint224 coverIdIndex; // The index of the coverId in its last tick
  }

  struct Compensation {
    uint64 fromPoolId;
    // The ratio is the claimed amount/ total liquidity in the claim pool
    uint256 ratio;
    uint256 strategyRewardIndexBeforeClaim;
    mapping(uint64 _poolId => uint256 _amount) liquidityIndexBeforeClaim;
  }

  struct VPool {
    uint64 poolId;
    uint256 feeRate; // amount of fees on premiums in RAY
    uint256 leverageFeePerPool; // amount of fees per pool when using leverage
    IEcclesiaDao dao;
    IStrategyManager strategyManager;
    PoolMath.Formula formula;
    Slot0 slot0;
    uint256 strategyId;
    address paymentAsset; // asset used to pay LP premiums
    address underlyingAsset; // asset covered & used by the strategy
    address wrappedAsset; // tokenised strategy shares (ex: aTokens)
    bool isPaused;
    uint64[] overlappedPools;
    uint256 ongoingClaims;
    uint256[] compensationIds;
    /**
     * Maps poolId 0 -> poolId 1 -> overlapping capital
     *
     * @dev poolId 0 -> poolId 0 points to a pool's own liquidity
     * @dev liquidity overlap is always registered in the lower poolId
     */
    mapping(uint64 _poolId => uint256 _amount) overlaps;
    mapping(uint256 _positionId => LpInfo) lpInfos;
    // Maps an word position index to a bitmap of tick states (initialized or not)
    mapping(uint24 _wordPos => uint256 _bitmap) tickBitmap;
    // Maps a tick to the list of cover IDs
    mapping(uint32 _tick => uint256[] _coverIds) ticks;
    // Maps a cover ID to the premium position of the cover
    mapping(uint256 _coverId => Cover) covers;
  }

  struct VPoolConstructorParams {
    uint64 poolId;
    IEcclesiaDao dao;
    IStrategyManager strategyManager;
    uint256 strategyId;
    address paymentAsset;
    uint256 feeRate; //Ray
    uint256 leverageFeePerPool; //Ray
    uint256 uOptimal; //Ray
    uint256 r0; //Ray
    uint256 rSlope1; //Ray
    uint256 rSlope2; //Ray
  }
}
