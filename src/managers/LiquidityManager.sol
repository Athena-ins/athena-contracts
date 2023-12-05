// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Parents
import { PositionPoolLiquidity } from "./PositionPoolLiquidity.sol";
// Addons
import { ERC721Enumerable, ERC721 } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
// Interfaces
import { IAthena } from "../interface/IAthena.sol";
import { IProtocolPool } from "../interface/IProtocolPool.sol";
import { IPositionsManager } from "../interface/IPositionsManager.sol";

contract PositionsManager is
  IPositionsManager,
  ERC721Enumerable,
  PositionPoolLiquidity
{
  address private core;

  /// The token ID position data
  mapping(uint256 => Position) private _positions;
  /// Maps a position ID to the the withdrawal commit timestamp
  mapping(uint256 => uint256) public withdrawCommitTimestamps;

  /// The ID of the next token that will be minted.
  uint176 private _nextTokenId = 0;

  constructor(
    address coreAddress,
    address poolFactory
  )
    ERC721("Athena-Position", "Athena Insurance User Position")
    PositionPoolLiquidity(poolFactory)
  {
    core = coreAddress;
  }

  /// ========================= ///
  /// ========= ERRORS ======== ///
  /// ========================= ///

  error WithdrawCommitDelayNotReached();

  /// =========================== ///
  /// ========= MODIFIER ======== ///
  /// =========================== ///

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function position(
    uint256 tokenId
  ) external view returns (Position memory) {
    return _positions[tokenId];
  }

  function positionLiquidity(
    uint256 tokenId
  ) external view returns (uint256) {
    return _positions[tokenId].amountSupplied;
  }

  function getFirstPositionPoolId(
    uint256 tokenId_
  ) external view returns (uint128) {
    return _positions[tokenId_].poolIds[0];
  }

  function hasPositionOf(address to) external view returns (bool) {
    return balanceOf(to) > 0;
  }

  function allPositionTokensOfOwner(
    address owner
  ) public view returns (uint256[] memory tokenList) {
    uint256 tokenLength = balanceOf(owner);
    tokenList = new uint256[](tokenLength);
    for (uint256 i = 0; i < tokenLength; i++)
      tokenList[i] = tokenOfOwnerByIndex(owner, i);
  }

  function allPositionsOfOwner(
    address owner
  ) external view returns (PositionInfo[] memory positionList) {
    uint256[] memory tokenList = allPositionTokensOfOwner(owner);
    positionList = new PositionInfo[](tokenList.length);

    // Loop through each tokenId (i) of a user
    for (uint256 i = 0; i < tokenList.length; i++) {
      uint256 tokenId = tokenList[i];
      Position memory __position = _positions[tokenId];

      uint256 finalCapital;
      uint256 totalRewards;

      // Loop through each poolId (j) in a tokenId
      for (uint256 j = 0; j < __position.poolIds.length; j++) {
        address poolAddress = _getPoolAddressById(
          __position.poolIds[j]
        );

        // Check the user's rewards in the pool
        (
          uint256 __newUserCapital,
          uint256 __totalRewards,

        ) = IProtocolPool(poolAddress).rewardsOf(
            tokenId,
            __position.amountSupplied,
            __position.poolIds,
            __position.feeRate,
            block.timestamp
          );

        totalRewards += __totalRewards;
        finalCapital = __newUserCapital;
      }

      // Include unrealized rewards & penalties in the initial capital
      __position.amountSupplied = finalCapital;

      positionList[i] = PositionInfo({
        positionId: tokenList[i],
        premiumReceived: totalRewards,
        position: __position
      });
    }
  }

  function allCapitalSuppliedByAccount(
    address account_
  ) external view returns (uint256 _capitalSupplied) {
    // @bw WARN this is ok for now but incomplete since the amount is the base capital
    // this should probably be adjusted with claims losses and APR gains
    uint256[] memory tokenList = allPositionTokensOfOwner(account_);

    for (uint256 i = 0; i < tokenList.length; i++) {
      Position memory _position = _positions[tokenList[i]];

      _capitalSupplied += _position.amountSupplied;
    }
  }

  function isProtocolInCoverList(
    uint128 _poolId,
    uint128[] memory _protocolList
  ) private pure returns (bool) {
    for (uint256 i = 0; i < _protocolList.length; i++) {
      if (_poolId == _protocolList[i]) return true;
    }

    return false;
  }

  /// ========================= ///
  /// ========= CREATE ======== ///
  /// ========================= ///

  function depositToPosition(
    address account,
    uint256 amount,
    uint256 newAaveScaledBalance,
    uint128 feeRate,
    uint128[] calldata poolIds
  ) external onlyCore {
    IAthena _core = IAthena(core);

    // Save new position tokenId and update for next
    uint256 tokenId = _nextTokenId;
    _nextTokenId++;

    // Ensure that all capital dependencies between pools are registered
    // Loop through each of the pools (i)
    uint128 maxCommitDelay;
    for (uint256 i = 0; i < poolIds.length; i++) {
      uint128 currentPoolId = poolIds[i];

      // Create an instance of the current pool
      IProtocolPool currentPool = IProtocolPool(
        _getPoolAddressById(currentPoolId)
      );

      // A position's commit delay is the highest commit delay among its pools
      // @dev create context to avoid stack too deep error
      // @bw test to see if it works
      {
        uint128 poolCommitDelay = currentPool.commitDelay();
        if (maxCommitDelay < poolCommitDelay)
          maxCommitDelay = poolCommitDelay;
      }

      // Loop through each latter pool (j)
      // @bw This create a lot of calls to the pools - need refactoring
      for (uint256 j = i + 1; j < poolIds.length; j++) {
        uint128 latterPoolId = poolIds[j];

        // Add the latter pool to the current pool dependencies
        currentPool.addRelatedProtocol(latterPoolId, amount);

        // Mirror the dependency of the current pool in the latter pool
        IProtocolPool(_getPoolAddressById(latterPoolId))
          .addRelatedProtocol(currentPoolId, amount);
      }

      _core.actualizingProtocolAndRemoveExpiredPolicies(
        address(currentPool)
      );

      // Deposit fund into pool and add amount to its own intersectingAmounts
      currentPool.depositToPool(tokenId, amount);
    }

    _positions[tokenId] = Position({
      createdAt: block.timestamp,
      amountSupplied: amount,
      aaveScaledBalance: newAaveScaledBalance,
      feeRate: feeRate,
      poolIds: poolIds,
      commitDelay: maxCommitDelay
    });

    _mint(account, tokenId);
  }

  /// ======================== ///
  /// ========= CLOSE ======== ///
  /// ======================== ///

  function committingWithdraw(uint256 tokenId_) external onlyCore {
    withdrawCommitTimestamps[tokenId_] = block.timestamp;
  }

  function checkDelayAndClosePosition(
    uint tokenId_
  ) external onlyCore {
    uint128 commitDelay = _positions[tokenId_].commitDelay;
    uint256 commitTimestamp = withdrawCommitTimestamps[tokenId_];

    if (block.timestamp < commitTimestamp + commitDelay)
      revert WithdrawCommitDelayNotReached();

    delete commitTimestamp;
    _burn(tokenId_);
  }

  /// ========================= ///
  /// ========= MODIFY ======== ///
  /// ========================= ///

  // @bw remove fn or check side effects - dangerous
  function removePoolId(
    uint256 tokenId,
    uint128 _poolId
  ) external onlyCore {
    uint128[] memory __poolIds = _positions[tokenId].poolIds;

    for (uint256 i = 0; i < __poolIds.length; i++) {
      if (__poolIds[i] == _poolId) {
        // @bw ERROR must fix if not leaves a "0" value in array
        // This should check if last item and if isn't remplace deleted with last item
        __poolIds[i] = __poolIds[__poolIds.length - 1];
        delete __poolIds[__poolIds.length - 1];
        break;
      }
    }

    _positions[tokenId].poolIds = __poolIds;
  }

  //Thao@TODO:
  //Il faut takeInterest avant de deposit pour update liquidityIndex et claimsIndex
  //see pool.deposit: LPsInfo[_account] = LPInfo(liquidityIndex, claims.length);
  // update pools in protocolsId: actualizing and remove, capital, slot0, intersectingAmount
  function updatePosition(
    address account,
    uint256 tokenId,
    uint256 amount,
    uint256 newAaveScaledBalance
  ) external onlyCore {
    IPositionsManager.Position memory userPosition = _positions[
      tokenId
    ];

    IAthena _core = IAthena(core);

    // Take interests in all pools before update
    _takeInterestsInAllPools(account, tokenId);

    // Ensure that all capital dependencies between pools are registered
    // Loop through each of the pools (i)
    for (uint256 i = 0; i < userPosition.poolIds.length; i++) {
      uint128 currentPoolId = userPosition.poolIds[i];

      // Create an instance of the current pool
      IProtocolPool currentPool = IProtocolPool(
        _getPoolAddressById(currentPoolId)
      );

      // Loop through each latter pool (j)
      for (uint256 j = i + 1; j < userPosition.poolIds.length; j++) {
        uint128 latterPoolId = userPosition.poolIds[j];

        // Add the latter pool to the current pool dependencies
        currentPool.addRelatedProtocol(latterPoolId, amount);

        // Mirror the dependency of the current pool in the latter pool
        IProtocolPool(_getPoolAddressById(latterPoolId))
          .addRelatedProtocol(currentPoolId, amount);
      }

      _core.actualizingProtocolAndRemoveExpiredPolicies(
        address(currentPool)
      );

      // Deposit fund into pool and add amount to its own intersectingAmounts
      currentPool.depositToPool(tokenId, amount);
    }

    _positions[tokenId].amountSupplied += amount;
    // @bw seems this should overwrite the old value not increment it
    _positions[tokenId].aaveScaledBalance += newAaveScaledBalance;
  }

  /// ================================= ///
  /// ========= TAKE INTERESTS ======== ///
  /// ================================= ///

  function takePositionInterests(
    address account,
    uint256 tokenId,
    uint128 poolId
  ) external onlyCore {
    Position memory _position = _positions[tokenId];

    require(
      isProtocolInCoverList(poolId, _position.poolIds),
      "Not in deposit protocol list"
    );

    IAthena _core = IAthena(core);
    address protocolAddress = _getPoolAddressById(poolId);
    _core.actualizingProtocolAndRemoveExpiredPolicies(
      protocolAddress
    );

    (
      uint256 _newUserCapital,
      uint256 _aaveScaledBalanceToRemove
    ) = IProtocolPool(protocolAddress).takePoolInterests(
        account,
        tokenId,
        _position.amountSupplied,
        _position.poolIds,
        _position.feeRate
      );

    if (_position.amountSupplied != _newUserCapital) {
      _positions[tokenId].amountSupplied = _newUserCapital;
      _positions[tokenId]
        .aaveScaledBalance -= _aaveScaledBalanceToRemove;
    }
  }

  function _takeInterestsInAllPools(
    address account,
    uint256 tokenId
  ) internal {
    Position memory userPosition = _positions[tokenId];
    IAthena _core = IAthena(core);

    uint256 amountSuppliedUpdated;
    uint256 aaveScaledBalanceUpdated;
    for (uint256 i = 0; i < userPosition.poolIds.length; i++) {
      uint128 poolId = userPosition.poolIds[i];

      address protocolAddress = _getPoolAddressById(poolId);
      _core.actualizingProtocolAndRemoveExpiredPolicies(
        protocolAddress
      );

      (
        uint256 _newUserCapital,
        uint256 _aaveScaledBalanceToRemove
      ) = IProtocolPool(protocolAddress).takePoolInterests(
          account,
          tokenId,
          userPosition.amountSupplied,
          userPosition.poolIds,
          userPosition.feeRate
        );

      // @bw unsure of this assign, should check if only last item should update or all of them
      if (i == userPosition.poolIds.length - 1) {
        amountSuppliedUpdated = _newUserCapital;
        aaveScaledBalanceUpdated = _aaveScaledBalanceToRemove;
      }
    }

    if (userPosition.amountSupplied != amountSuppliedUpdated) {
      _positions[tokenId].amountSupplied = amountSuppliedUpdated;
      _positions[tokenId]
        .aaveScaledBalance -= aaveScaledBalanceUpdated;
    }
  }

  function takeInterestsInAllPools(
    address account,
    uint256 tokenId
  ) external onlyCore {
    _takeInterestsInAllPools(account, tokenId);
  }

  /// ============================ ///
  /// ========= LIQUIDITY ======== ///
  /// ============================ ///

  function getAvailableCapital(
    uint128 poolId_
  ) external view returns (uint256) {
    return _getAvailableCapital(poolId_);
  }

  function claimLiquidityRemoval(
    uint128 coverPoolId_,
    uint256 amount_,
    uint256 reserveNormalizedIncome_
  ) external onlyCore {
    _claimLiquidityRemoval(
      coverPoolId_,
      amount_,
      reserveNormalizedIncome_
    );
  }

  /// ======================== ///
  /// ========= ADMIN ======== ///
  /// ======================== ///

  /**
   * @notice
   * Update the fee level of a position according to amount of staked ATEN.
   * @param tokenId_ the position to be uptdated
   * @param newFeeRate_ the new fee rate of the position
   **/
  function updateFeeLevel(
    uint256 tokenId_,
    uint128 newFeeRate_
  ) external onlyCore {
    // @bw should probably change feeRate to a global map instead of saving in each position
    _positions[tokenId_].feeRate = newFeeRate_;
  }
}

// Libs
import { RayMath } from "../libs/RayMath.sol";
// Interfaces
import { IProtocolPool } from "../interface/IProtocolPool.sol";
import { IProtocolFactory } from "../interface/IProtocolFactory.sol";

// @bw we want to move in the ratio calc

contract PositionPoolLiquidity {
  using RayMath for uint256;

  IProtocolFactory public poolFactoryInterface;

  struct PoolOverlap {
    uint128 poolId;
    uint256 amount;
  }

  // Maps poolId 0 -> poolId 1 -> overlapping capital
  // @dev poolId A -> poolId A points to a pool's self available liquidity
  // @dev liquidity overlap is always registered in the lower poolId
  mapping(uint128 _poolId0 => mapping(uint128 _poolId1 => uint256 _amount))
    public overlappingLiquidity;
  // Maps pool IDs to the overlapped pool IDs
  mapping(uint128 _poolId => uint128[] _poolDependants)
    public dependantPools;

  constructor(address poolFactory) {
    poolFactoryInterface = IProtocolFactory(poolFactory);
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function _getAvailableCapital(
    uint128 poolId
  ) internal view returns (uint256) {
    return overlappingLiquidity[poolId][poolId];
  }

  function getOverlappingCapital(
    uint128 poolIdA,
    uint128 poolIdB
  ) external view returns (uint256) {
    (uint128 poolId0, uint128 poolId1) = poolIdA < poolIdB
      ? (poolIdA, poolIdB)
      : (poolIdB, poolIdA);

    return overlappingLiquidity[poolId0][poolId1];
  }

  function getAllOverlappingCapital(
    uint128 poolId
  ) external view returns (PoolOverlap[] memory) {
    uint256 nbPoolIds = dependantPools[poolId].length;

    PoolOverlap[] memory overlaps = new PoolOverlap[](nbPoolIds);

    for (uint256 i = 0; i < nbPoolIds; i++) {
      uint128 currentPool = dependantPools[poolId][i];

      (uint128 poolId0, uint128 poolId1) = currentPool < poolId
        ? (currentPool, poolId)
        : (poolId, currentPool);

      overlaps[i] = PoolOverlap({
        poolId: currentPool,
        amount: overlappingLiquidity[poolId0][poolId1]
      });
    }

    return overlaps;
  }

  /// ========================== ///
  /// ========= HELPERS ======== ///
  /// ========================== ///

  function _getPoolAddressById(
    uint128 poolId_
  ) internal view returns (address) {
    return poolFactoryInterface.getPoolAddress(poolId_);
  }

  /// =========================== ///
  /// ========= OVERLAPS ======== ///
  /// =========================== ///

  function _addOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 amount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i = 0; i < nbPoolIds; i++) {
      for (uint128 j = 0; j < nbPoolIds; j++) {
        uint128 poolId0 = poolIds_[i];
        uint128 poolId1 = poolIds_[j];

        // Avoid incrementing twice the same pool combination
        if (poolId1 < poolId0) continue;

        if (
          poolId0 != poolId1 &&
          overlappingLiquidity[poolId0][poolId1] == 0
        ) {
          dependantPools[poolId0].push(poolId1);
          dependantPools[poolId1].push(poolId0);
        }

        // We allow poolId0 to be equal to poolId1 to increment a pool's own capital
        overlappingLiquidity[poolId0][poolId1] += amount_;
      }
    }
  }

  function _removeOverlappingCapital(
    uint128[] memory poolIds_,
    uint256 amount_
  ) internal {
    uint256 nbPoolIds = poolIds_.length;

    for (uint128 i = 0; i < nbPoolIds; i++) {
      for (uint128 j = 0; j < nbPoolIds; j++) {
        uint128 poolId0 = poolIds_[i];
        uint128 poolId1 = poolIds_[j];

        // Avoid incrementing twice the same pool combination
        if (poolId1 < poolId0) continue;

        // We allow poolId0 to be equal to poolId1 to decrement a pool's own capital
        overlappingLiquidity[poolId0][poolId1] -= amount_;
      }
    }
  }

  /// ========================= ///
  /// ========= CLAIMS ======== ///
  /// ========================= ///

  function _claimLiquidityRemoval(
    uint128 coverPoolId_,
    uint256 amount_,
    uint256 reserveNormalizedIncome_
  ) internal {
    uint256 availableCapital = overlappingLiquidity[coverPoolId_][
      coverPoolId_
    ];
    uint256 ratio = amount_.rayDiv(availableCapital);

    uint256 nbPoolIds = dependantPools[coverPoolId_].length;

    for (uint128 i = 0; i < nbPoolIds + 1; i++) {
      uint128 currentPool = i == nbPoolIds
        ? coverPoolId_
        : dependantPools[coverPoolId_][i];

      (uint128 poolId0, uint128 poolId1) = currentPool < coverPoolId_
        ? (currentPool, coverPoolId_)
        : (coverPoolId_, currentPool);

      uint256 overlapAmount = overlappingLiquidity[poolId0][poolId1];
      uint256 amountToRemove = overlapAmount.rayMul(ratio);

      overlappingLiquidity[poolId0][poolId1] -= amountToRemove;
      overlappingLiquidity[currentPool][
        currentPool
      ] -= amountToRemove;

      // call process claim on protocol pool
      address poolAddress = _getPoolAddressById(currentPool);
      // IProtocolPool(poolAddress).processClaim(coverPoolId_,amountToRemove);
    }
  }
}
