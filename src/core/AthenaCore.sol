// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Libraries
import { RayMath } from "../libs/RayMath.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { ILendingPool } from "./interfaces/ILendingPool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IAthena } from "../interfaces/IAthena.sol";
import { IProtocolFactory } from "../interfaces/IProtocolFactory.sol";
import { IProtocolPool } from "../interfaces/IProtocolPool.sol";
import { IPositionManager } from "../interfaces/IPositionManager.sol";
import { IPolicyManager } from "../interfaces/IPolicyManager.sol";
import { IClaimManager } from "../interfaces/IClaimManager.sol";

contract Athena is ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  ILendingPool public aaveLendingPool;

  IERC20 public atenTokenInterface;

  IPositionManager public positionManagerInterface;
  IPolicyManager public policyManagerInterface;
  IClaimManager public claimManagerInterface;

  IProtocolFactory public protocolFactoryInterface;

  // Maps tokens used by pool to its AAVE lending pool approval status
  mapping(address token => bool isApproved) public approvedTokens;

  constructor(
    address atenTokenAddress_,
    ILendingPool aaveLendingPool_
  ) Ownable(msg.sender) {
    aaveLendingPool = aaveLendingPool_;
    atenTokenInterface = IERC20(atenTokenAddress_);
  }

  function initialize(
    address _positionManagerAddress,
    address _policyManagerAddress,
    address _claimManagerAddress,
    address _protocolFactory
  ) external onlyOwner {
    positionManagerInterface = IPositionManager(
      _positionManagerAddress
    );
    policyManagerInterface = IPolicyManager(_policyManagerAddress);
    claimManagerInterface = IClaimManager(_claimManagerAddress);

    protocolFactoryInterface = IProtocolFactory(_protocolFactory);
  }

  /// ========================= ///
  /// ========= ERRORS ======== ///
  /// ========================= ///

  error NotClaimManager();
  error NotPositionOwner();
  error NotPolicyOwner();
  error PolicyExpired();
  error ProtocolIsInactive();
  error SamePoolIds();
  error IncompatibleProtocol(uint256, uint256);
  error OutOfRange();
  error WithdrawableAmountIsZero();
  error UserHasNoPositions();
  error WithdrawCommitDelayNotReached();
  error AmountEqualToZero();
  error AmountAtenTooHigh();
  error MissingBaseRate();
  error MustSortInAscendingOrder();
  error PoolPaused();
  error PoolHasOngoingClaimsOrPaused();
  error UnderlyingTokenMismatch();

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  event NewProtocol(uint128);

  /// ============================ ///
  /// ========= MODIFIERS ======== ///
  /// ============================ ///

  modifier onlyClaimManager() {
    if (msg.sender != address(claimManagerInterface)) {
      revert NotClaimManager();
    }
    _;
  }

  /**
   * @notice
   * Check caller is owner of the position supply NFT
   * @param positionId_ position supply NFT ID
   */
  modifier onlyPositionTokenOwner(uint256 positionId_) {
    address ownerOfToken = positionManagerInterface.ownerOf(
      positionId_
    );
    if (msg.sender != ownerOfToken) {
      revert NotPositionOwner();
    }
    _;
  }

  /**
   * @notice
   * Check caller is owner of the policy holder NFT
   * @param policyId_ policy holder NFT ID
   */
  modifier onlyPolicyTokenOwner(uint256 policyId_) {
    address ownerOfToken = policyManagerInterface.ownerOf(policyId_);
    if (msg.sender != ownerOfToken) {
      revert NotPolicyOwner();
    }
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function coverManager() external view returns (address) {
    return address(policyManagerInterface);
  }

  function getPoolAddressById(
    uint128 poolId
  ) public view returns (address) {
    return protocolFactoryInterface.getPoolAddress(poolId);
  }

  function getProtocol(
    uint128 poolId_
  ) public view returns (ProtocolView memory) {
    IProtocolFactory.Protocol memory pool = protocolFactoryInterface
      .getPool(poolId_);

    (
      uint256 insuredCapital,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate,
      IProtocolPool.Formula memory computingConfig
    ) = IProtocolPool(pool.deployed).protocolInfo();

    string memory claimAgreement = claimManagerInterface
      .getPoolCoverTerms(poolId_);

    uint256 aaveLiquidityRate = aaveLendingPool
      .getReserveData(pool.token)
      .currentLiquidityRate;

    uint128[] memory incompatiblePools = protocolFactoryInterface
      .getIncompatiblePools(poolId_);

    return
      ProtocolView({
        name: pool.name,
        paused: pool.paused,
        claimsOngoing: pool.claimsOngoing,
        poolId: poolId_,
        deployed: pool.deployed,
        token: pool.token,
        insuredCapital: insuredCapital,
        availableCapacity: availableCapacity,
        utilizationRate: utilizationRate,
        premiumRate: premiumRate,
        aaveLiquidityRate: aaveLiquidityRate,
        computingConfig: computingConfig,
        claimAgreement: claimAgreement,
        commitDelay: pool.commitDelay,
        incompatiblePools: incompatiblePools
      });
  }

  function getAllProtocols()
    external
    view
    returns (ProtocolView[] memory protocols)
  {
    uint128 nextPoolId = protocolFactoryInterface.getNextPoolId();

    protocols = new ProtocolView[](nextPoolId);
    for (uint128 i = 0; i < nextPoolId; i++) {
      protocols[i] = getProtocol(i);
    }
  }

  /// ========================== ///
  /// ========= HELPERS ======== ///
  /// ========================== ///

  function actualizingProtocolAndRemoveExpiredPolicies(
    address protocolAddress
  ) public override {
    uint256[] memory expiredTokens = IProtocolPool(protocolAddress)
      .actualizing();

    if (0 < expiredTokens.length) {
      policyManagerInterface.processExpiredTokens(expiredTokens);
    }
  }

  function actualizingProtocolAndRemoveExpiredPoliciesByPoolId(
    uint128 poolId_
  ) public {
    actualizingProtocolAndRemoveExpiredPolicies(
      getPoolAddressById(poolId_)
    );
  }

  /*
   * @notice
   * Transfer liquidity to AAVE lending pool
   * @param token_ address of the token to be deposited (not aToken)
   * @param amount_ amount of tokens to be deposited
   * @return normalizedIncome price in rays of the aToken
   *
   * @dev For example a return value of 2∗1e27 means 2 tokens = 1 aToken
   */
  function _transferLiquidityToAAVE(
    address token_,
    uint256 amount_
  ) private returns (uint256 normalizedIncome) {
    aaveLendingPool.deposit(token_, amount_, address(this), 0);

    normalizedIncome = amount_.rayDiv(
      aaveLendingPool.getReserveNormalizedIncome(token_)
    );
  }

  function _updateUserPositionFeeRate(address account_) private {
    // Check if user has positions that will require an update
    uint256[] memory tokenList = positionManagerInterface
      .allPositionTokensOfOwner(account_);

    // If the user has positions check if unstaking affects fee level
    if (tokenList.length != 0) {
      // Get the user's first position
      IPositionManager.Position
        memory userPosition = positionManagerInterface.position(
          tokenList[0]
        );
      uint128 currentFeeLevel = userPosition.feeRate;

      // Compute the fee level after adding accrued interests and removing withdrawal
      uint128 newFeeLevel = stakedAtensGPInterface.getUserFeeRate(
        account_
      );

      // If the fee level changes, update all positions
      if (currentFeeLevel != newFeeLevel) {
        for (uint256 i = 0; i < tokenList.length; i++) {
          positionManagerInterface.takeInterestsInAllPools(
            account_,
            tokenList[i]
          );

          positionManagerInterface.updateFeeLevel(
            tokenList[i],
            newFeeLevel
          );
        }
      }
    }
  }

  function _prepareCoverUpdate(
    uint256 coverId_
  ) private returns (address poolAddress, uint128 poolId) {
    poolId = policyManagerInterface.poolIdOfPolicy(coverId_);
    poolAddress = getPoolAddressById(poolId);
    actualizingProtocolAndRemoveExpiredPolicies(poolAddress);
  }

  /// =============================== ///
  /// ========== POSITIONS ========== ///
  /// =============================== ///

  function deposit(
    uint256 amount,
    uint128[] calldata poolIds
  ) public {
    // Check if the poolIds do not include incompatible pools
    protocolFactoryInterface.validePoolIds(poolIds);

    // @bw This check should be delegated to validatePoolIds and deleted
    // We only allow positions with the same underlying token
    address underlyingToken = protocolFactoryInterface
      .getPoolUnderlyingToken(poolIds[0]);
    if (poolIds.length != 1) {
      for (uint256 i = 1; i < poolIds.length; i++) {
        address nextUnderlyingToken = protocolFactoryInterface
          .getPoolUnderlyingToken(poolIds[i]);
        if (underlyingToken != nextUnderlyingToken)
          revert UnderlyingTokenMismatch();
      }
    }

    // retrieve user funds for coverage
    IERC20(underlyingToken).safeTransferFrom(
      msg.sender,
      address(this),
      amount
    );

    // Deposit the funds into AAVE and get the new scaled balance
    uint256 newAaveScaledBalance = _transferLiquidityToAAVE(
      underlyingToken,
      amount
    );

    // If user has staked ATEN then get feeRate
    uint128 supplyFeeRate = stakedAtensGPInterface.getUserFeeRate(
      msg.sender
    );

    // deposit assets in the pool and create position NFT
    positionManagerInterface.depositToPosition(
      msg.sender,
      amount,
      newAaveScaledBalance,
      supplyFeeRate,
      poolIds
    );
  }

  function takeInterest(
    uint256 tokenId,
    uint128 poolId
  ) public onlyPositionTokenOwner(tokenId) {
    positionManagerInterface.takePositionInterests(
      msg.sender,
      tokenId,
      poolId
    );
  }

  function takeInterestInAllPools(
    uint256 tokenId
  ) public onlyPositionTokenOwner(tokenId) {
    positionManagerInterface.takeInterestsInAllPools(
      msg.sender,
      tokenId
    );
  }

  function addLiquidityToPosition(
    uint256 tokenId,
    uint256 amount
  ) external onlyPositionTokenOwner(tokenId) {
    // This is ok because we only allow positions with the same underlying token
    uint128 firstPositionPoolId = positionManagerInterface
      .getFirstPositionPoolId(tokenId);
    address underlyingToken = protocolFactoryInterface
      .getPoolUnderlyingToken(firstPositionPoolId);
    // Retrieve user funds for coverage
    IERC20(underlyingToken).safeTransferFrom(
      msg.sender,
      address(this),
      amount
    );

    // Deposit the funds into AAVE and get the new scaled balance
    uint256 newAaveScaledBalance = _transferLiquidityToAAVE(
      underlyingToken,
      amount
    );

    positionManagerInterface.updatePosition(
      msg.sender,
      tokenId,
      amount,
      newAaveScaledBalance
    );
  }

  function committingWithdrawAll(
    uint256 tokenId
  ) external onlyPositionTokenOwner(tokenId) {
    uint256 userBalance = positionManagerInterface.balanceOf(
      msg.sender
    );
    if (userBalance == 0) revert UserHasNoPositions();

    positionManagerInterface.committingWithdraw(tokenId);
  }

  function withdrawAll(
    uint256 tokenId
  ) external onlyPositionTokenOwner(tokenId) {
    IPositionManager.Position
      memory __position = positionManagerInterface.position(tokenId);

    uint256 __newUserCapital;
    uint256 __aaveScaledBalanceToRemove;

    bool canWithdraw = protocolFactoryInterface.canWithdrawFromPools(
      __position.poolIds
    );
    if (!canWithdraw) revert PoolHasOngoingClaimsOrPaused();

    for (uint256 i = 0; i < __position.poolIds.length; i++) {
      IProtocolPool __protocol = IProtocolPool(
        getPoolAddressById(__position.poolIds[i])
      );

      actualizingProtocolAndRemoveExpiredPolicies(
        address(__protocol)
      );

      (__newUserCapital, __aaveScaledBalanceToRemove) = __protocol
        .withdrawLiquidity(
          msg.sender,
          tokenId,
          __position.amountSupplied,
          __position.poolIds,
          __position.feeRate
        );
    }

    positionManagerInterface.checkDelayAndClosePosition(tokenId);

    // This is ok because we only allow positions with the same underlying token
    address underlyingToken = protocolFactoryInterface
      .getPoolUnderlyingToken(__position.poolIds[0]);
    // @bw withdrawn amount is bad here
    uint256 _amountToWithdrawFromAAVE = __position
      .aaveScaledBalance
      .rayMul(
        aaveLendingPool.getReserveNormalizedIncome(underlyingToken)
      );

    aaveLendingPool.withdraw(
      underlyingToken,
      _amountToWithdrawFromAAVE,
      msg.sender
    );
  }

  /// ============================== ///
  /// ========== POLICIES ========== ///
  /// ============================== ///

  //////Thao@NOTE: Policy
  function buyPolicies(
    uint256[] calldata amountCoveredArray_,
    uint256[] calldata premiumDepositArray_,
    uint128[] calldata poolIdArray_
  ) public nonReentrant {
    uint256 nbPolicies = poolIdArray_.length;

    bool poolsPaused = protocolFactoryInterface.arePoolsPaused(
      poolIdArray_
    );
    if (!poolsPaused) revert PoolPaused();

    for (uint256 i = 0; i < nbPolicies; i++) {
      uint256 _amountCovered = amountCoveredArray_[i];
      uint256 _premiumDeposit = premiumDepositArray_[i];
      uint128 _poolId = poolIdArray_[i];

      if (_amountCovered == 0 || _premiumDeposit == 0)
        revert AmountEqualToZero();

      address poolAddress = getPoolAddressById(_poolId);

      address underlyingToken = protocolFactoryInterface
        .getPoolUnderlyingToken(_poolId);
      IERC20(underlyingToken).safeTransferFrom(
        msg.sender,
        poolAddress,
        _premiumDeposit
      );

      uint256 coverId = policyManagerInterface.mint(
        msg.sender,
        _amountCovered,
        _premiumDeposit,
        _poolId
      );

      actualizingProtocolAndRemoveExpiredPolicies(poolAddress);

      IProtocolPool(poolAddress).buyPolicy(
        msg.sender,
        coverId,
        _premiumDeposit,
        _amountCovered
      );
    }
  }

  /// -------- COVER UPDATE -------- ///

  function increaseCover(
    uint256 coverId_,
    uint256 amount_
  ) external onlyPolicyTokenOwner(coverId_) {
    (address poolAddress, ) = _prepareCoverUpdate(coverId_);
    policyManagerInterface.increaseCover(coverId_, amount_);
    IProtocolPool(poolAddress).increaseCover(coverId_, amount_);
  }

  function decreaseCover(
    uint256 coverId_,
    uint256 amount_
  ) external onlyPolicyTokenOwner(coverId_) {
    (address poolAddress, ) = _prepareCoverUpdate(coverId_);
    policyManagerInterface.decreaseCover(coverId_, amount_);
    IProtocolPool(poolAddress).decreaseCover(coverId_, amount_);
  }

  function addPremiums(
    uint256 coverId_,
    uint256 amount_
  ) external onlyPolicyTokenOwner(coverId_) {
    (address poolAddress, uint128 poolId) = _prepareCoverUpdate(
      coverId_
    );

    address underlyingToken = protocolFactoryInterface
      .getPoolUnderlyingToken(poolId);
    IERC20(underlyingToken).safeTransferFrom(
      msg.sender,
      poolAddress,
      amount_
    );

    policyManagerInterface.addPremiums(coverId_, amount_);
    IProtocolPool(poolAddress).addPremiums(coverId_, amount_);
  }

  function removePremiums(
    uint256 coverId_,
    uint256 amount_
  ) external onlyPolicyTokenOwner(coverId_) {
    (address poolAddress, ) = _prepareCoverUpdate(coverId_);

    policyManagerInterface.removePremiums(coverId_, amount_);
    IProtocolPool(poolAddress).removePremiums(
      coverId_,
      amount_,
      msg.sender
    );
  }

  /// -------- CLOSE -------- ///

  /**
   * @notice
   * Closes the policy of a user and withdraws remaining funds, staked ATEN and potential staking rewards.
   * @param policyId_ id of the policy to close
   */
  function withdrawPolicy(
    uint256 policyId_
  ) public onlyPolicyTokenOwner(policyId_) nonReentrant {
    // Get the policy
    IPolicyManager.Policy memory userPolicy = policyManagerInterface
      .policy(policyId_);
    address poolAddress = getPoolAddressById(userPolicy.poolId);

    // Remove expired policies
    actualizingProtocolAndRemoveExpiredPolicies(poolAddress);

    // Require that the policy is still active
    bool isStillActive = policyManagerInterface.policyActive(
      policyId_
    );
    if (isStillActive != true) revert PolicyExpired();

    // Updates pool liquidity and withdraws remaining funds to user
    IProtocolPool(poolAddress).withdrawPolicy(
      msg.sender,
      policyId_,
      userPolicy.amountCovered
    );

    // Expire the cover of the user
    policyManagerInterface.expireCover(policyId_, true);
  }

  /// ============================ ///
  /// ========== CLAIMS ========== ///
  /// ============================ ///

  /**
   * @notice
   * Called by the claim manager to compensate the claimant.
   * @param policyId_ the id of the policy
   * @param amount_ the amount to compensate
   * @param account_ the address of the claimant
   */
  function compensateClaimant(
    uint256 policyId_,
    uint256 amount_,
    address account_
  ) external onlyClaimManager {
    IPolicyManager.Policy memory userPolicy = policyManagerInterface
      .policy(policyId_);
    uint128 poolId = userPolicy.poolId;

    address poolAddress = getPoolAddressById(poolId);

    IProtocolPool poolInterface = IProtocolPool(poolAddress);
    uint256 ratio = poolInterface.ratioWithAvailableCapital(amount_);

    address underlyingToken = protocolFactoryInterface
      .getPoolUnderlyingToken(poolId);
    uint256 reserveNormalizedIncome = aaveLendingPool
      .getReserveNormalizedIncome(underlyingToken);

    // @bw - overlap here we need the list of related protocols
    uint128[] memory relatedProtocols = poolInterface
      .getRelatedProtocols();
    for (uint256 i = 0; i < relatedProtocols.length; i++) {
      uint128 relatedPoolId = relatedProtocols[i];

      address relatedPoolAddress = getPoolAddressById(relatedPoolId);

      actualizingProtocolAndRemoveExpiredPolicies(relatedPoolAddress);

      IProtocolPool(relatedPoolAddress).processClaim(
        poolId,
        ratio,
        reserveNormalizedIncome
      );
    }

    aaveLendingPool.withdraw(underlyingToken, amount_, account_);
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  /// -------- PROTOCOL POOLS -------- ///

  function addNewProtocol(
    address token_,
    string calldata name_,
    uint128[] calldata incompatiblePools_,
    uint128 commitDelay_,
    string calldata ipfsAgreementCid_,
    uint256 uOptimal_,
    uint256 r0_,
    uint256 rSlope1_,
    uint256 rSlope2_
  ) public onlyOwner {
    if (!approvedTokens[token_]) {
      IERC20(token_).safeIncreaseAllowance(
        address(aaveLendingPool),
        type(uint256).max
      );
      approvedTokens[token_] = true;
    }

    uint128 poolId = protocolFactoryInterface.deployProtocol(
      token_,
      name_,
      incompatiblePools_,
      commitDelay_,
      uOptimal_,
      r0_,
      rSlope1_,
      rSlope2_
    );

    // Add the meta evidence IPFS address to the registry
    claimManagerInterface.addCoverTermsForPool(
      poolId,
      ipfsAgreementCid_
    );
  }

  /// -------- AAVE -------- ///

  function updateLendingPool(
    ILendingPool aaveLendingPool_
  ) external onlyOwner {
    aaveLendingPool = aaveLendingPool_;
  }
}
