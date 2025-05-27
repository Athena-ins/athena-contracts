// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.25;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Interfaces
import { IOwnable } from "../interfaces/IOwnable.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IStrategyManager } from "../interfaces/IStrategyManager.sol";
import { IClaimManager } from "../interfaces/IClaimManager.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IArbitrator } from "@kleros/dispute-resolver-interface-contract/contracts/IDisputeResolver.sol";

/**
 * @title Protocol Manager
 * @author vblackwhale
 *
 * @notice This contract serves as a central entry point for administrative functions
 * across the Athena Protocol. It allows a Gnosis multisig to manage
 * ClaimManager, StrategyManager, and LiquidityManager from a single contract.
 */
contract ProtocolManager is Ownable {
  // ======= STORAGE ======= //

  IAthenaPositionToken public positionToken;
  IAthenaCoverToken public coverToken;

  ILiquidityManager public liquidityManager;
  IStrategyManager public strategyManager;
  IClaimManager public claimManager;
  IEcclesiaDao public ecclesiaDao;

  address public yieldRewarder;
  address public buybackWallet;
  address public evidenceGuardian;

  // ======= ERRORS ======= //

  error AddressZero();

  // ======= STRUCTS ======= //

  /// @notice Configuration parameters for a pool
  /// @param poolId Unique identifier of the pool
  /// @param feeRate Fee rate for the pool
  /// @param uOptimal Optimal utilization rate
  /// @param r0 Base interest rate
  /// @param rSlope1 First slope parameter for interest rate calculation
  /// @param rSlope2 Second slope parameter for interest rate calculation
  struct PoolConfig {
    uint64 poolId;
    uint256 feeRate;
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  /// @notice Parameters required for creating a new pool
  /// @param paymentAsset Address of the token used for payments
  /// @param strategyId Identifier of the strategy to be used
  /// @param feeRate Fee rate for the pool
  /// @param uOptimal Optimal utilization rate
  /// @param r0 Base interest rate
  /// @param rSlope1 First slope parameter for interest rate calculation
  /// @param rSlope2 Second slope parameter for interest rate calculation
  /// @param compatiblePools Array of pool IDs that are compatible with this pool
  struct PoolCreationParams {
    address paymentAsset;
    uint256 strategyId;
    uint256 feeRate;
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
    uint64[] compatiblePools;
  }

  // ======= CONSTRUCTOR ======= //

  constructor(
    IAthenaPositionToken positionToken_,
    IAthenaCoverToken coverToken_,
    ILiquidityManager liquidityManager_,
    IStrategyManager strategyManager_,
    IClaimManager claimManager_,
    IEcclesiaDao ecclesiaDao_,
    address yieldRewarder_,
    address buybackWallet_,
    address evidenceGuardian_
  ) Ownable(msg.sender) {
    positionToken = positionToken_;
    coverToken = coverToken_;

    liquidityManager = liquidityManager_;
    strategyManager = strategyManager_;
    claimManager = claimManager_;
    ecclesiaDao = ecclesiaDao_;

    yieldRewarder = yieldRewarder_;
    buybackWallet = buybackWallet_;
    evidenceGuardian = evidenceGuardian_;
  }

  // ======= MANAGER SETTERS ======= //

  /**
   * @notice Updates the LiquidityManager contract address
   * @param positionToken_ The new PositionToken contract address
   * @param coverToken_ The new CoverToken contract address
   * @param liquidityManager_ The new LiquidityManager contract address
   * @param strategyManager_ The new StrategyManager contract address
   * @param claimManager_ The new ClaimManager contract address
   * @param ecclesiaDao_ The new EcclesiaDao contract address
   * @param yieldRewarder_ The new YieldRewarder contract address
   * @param buybackWallet_ The new BuybackWallet contract address
   * @param evidenceGuardian_ The new EvidenceGuardian contract address
   */
  function setAddresses(
    IAthenaPositionToken positionToken_,
    IAthenaCoverToken coverToken_,
    ILiquidityManager liquidityManager_,
    IStrategyManager strategyManager_,
    IClaimManager claimManager_,
    IEcclesiaDao ecclesiaDao_,
    address yieldRewarder_,
    address buybackWallet_,
    address evidenceGuardian_
  ) external onlyOwner {
    if (address(positionToken_) != address(0))
      positionToken = positionToken_;
    if (address(coverToken_) != address(0)) coverToken = coverToken_;

    if (address(liquidityManager_) != address(0))
      liquidityManager = liquidityManager_;
    if (address(strategyManager_) != address(0))
      strategyManager = strategyManager_;
    if (address(claimManager_) != address(0))
      claimManager = claimManager_;
    if (address(ecclesiaDao_) != address(0))
      ecclesiaDao = ecclesiaDao_;

    if (yieldRewarder_ != address(0)) yieldRewarder = yieldRewarder_;
    if (buybackWallet_ != address(0)) buybackWallet = buybackWallet_;
    if (evidenceGuardian_ != address(0))
      evidenceGuardian = evidenceGuardian_;
  }

  // ======= OWNERSHIP FUNCTIONS ======= //

  /**
   * @notice Transfers ownership of a contract to a new owner
   * @param contracts_ The addresses of the contracts
   * @param newOwner_ The address of the new owner
   */
  function transferContractOwnership(
    address[] memory contracts_,
    address newOwner_
  ) external onlyOwner {
    if (newOwner_ == address(0)) revert AddressZero();

    for (uint256 i = 0; i < contracts_.length; i++) {
      address target = contracts_[i];
      if (target == address(0)) revert AddressZero();

      IOwnable(target).transferOwnership(newOwner_);
    }
  }

  // ======= LIQUIDITY MANAGER FUNCTIONS ======= //

  /// @notice Pauses or unpauses multiple pools in a single transaction
  /// @param poolIds Array of pool IDs to modify
  /// @param isPaused True to pause pools, false to unpause
  function batchPausePool(
    uint64[] calldata poolIds,
    bool isPaused
  ) external onlyOwner {
    for (uint256 i = 0; i < poolIds.length; i++) {
      liquidityManager.pausePool(poolIds[i], isPaused);
    }
  }

  /// @notice Creates multiple pools in a single transaction
  /// @param params Array of pool creation parameters
  function batchCreatePool(
    PoolCreationParams[] calldata params
  ) external onlyOwner {
    for (uint256 i = 0; i < params.length; i++) {
      liquidityManager.createPool(
        params[i].paymentAsset,
        params[i].strategyId,
        params[i].feeRate,
        params[i].uOptimal,
        params[i].r0,
        params[i].rSlope1,
        params[i].rSlope2,
        params[i].compatiblePools
      );
    }
  }

  /// @notice Updates configuration for multiple pools in a single transaction
  /// @param configs Array of pool configurations to update
  function batchUpdatePoolConfig(
    PoolConfig[] calldata configs
  ) external onlyOwner {
    for (uint256 i = 0; i < configs.length; i++) {
      liquidityManager.updatePoolConfig(
        configs[i].poolId,
        configs[i].feeRate,
        configs[i].uOptimal,
        configs[i].r0,
        configs[i].rSlope1,
        configs[i].rSlope2
      );
    }
  }

  /// @notice Updates compatibility between multiple pools in a single transaction
  /// @param poolIds Array of pool IDs to update
  /// @param poolIdCompatible Array of arrays containing compatible pool IDs for each pool
  /// @param poolIdCompatibleStatus Array of arrays containing compatibility status for each pool pair
  function batchUpdatePoolCompatibility(
    uint64[] calldata poolIds,
    uint64[][] calldata poolIdCompatible,
    bool[][] calldata poolIdCompatibleStatus
  ) external onlyOwner {
    liquidityManager.updatePoolCompatibility(
      poolIds,
      poolIdCompatible,
      poolIdCompatibleStatus
    );
  }

  /**
   * @notice Freezes or unfreezes the protocol
   * @param isFrozen_ True if the protocol should be frozen
   */
  function freezeProtocol(bool isFrozen_) external onlyOwner {
    liquidityManager.freezeProtocol(isFrozen_);
  }

  /**
   * @notice Updates key configuration parameters of the LiquidityManager
   * @param withdrawDelay_ The new withdraw delay
   * @param maxLeverage_ The new maximum leverage
   * @param leverageFeePerPool_ The new leverage fee per pool
   */
  function updateLiquidityManagerConfig(
    uint256 withdrawDelay_,
    uint256 maxLeverage_,
    uint256 leverageFeePerPool_
  ) external onlyOwner {
    liquidityManager.updateConfig(
      ecclesiaDao,
      strategyManager,
      address(claimManager),
      yieldRewarder,
      withdrawDelay_,
      maxLeverage_,
      leverageFeePerPool_
    );
  }

  /**
   * @notice Purges a pool's expired covers up to a certain timestamp
   * @param poolId_ The ID of the pool
   * @param timestamp_ The timestamp up to which to purge the covers
   */
  function purgeExpiredCoversUpTo(
    uint64 poolId_,
    uint256 timestamp_
  ) external onlyOwner {
    liquidityManager.purgeExpiredCoversUpTo(poolId_, timestamp_);
  }

  /**
   * @notice Updates a position up to a certain compensation index
   * @param positionId_ The ID of the position
   * @param endCompensationIndexes_ The end indexes of the compensations to update up to for each pool
   */
  function updatePositionUpTo(
    uint256 positionId_,
    uint256[] calldata endCompensationIndexes_
  ) external onlyOwner {
    liquidityManager.updatePositionUpTo(
      positionId_,
      endCompensationIndexes_
    );
  }

  // ======= STRATEGY MANAGER FUNCTIONS ======= //

  /**
   * @notice Updates the addresses of the liquidity manager, ecclesiaDao, and buyback wallet
   */
  function updateStrategyManagerAddressList() external onlyOwner {
    strategyManager.updateAddressList(
      liquidityManager,
      ecclesiaDao,
      buybackWallet
    );
  }

  /**
   * @notice Updates the performance fee for the strategy
   * @param rate_ The new performance fee rate in RAY
   */
  function updateStrategyFeeRate(uint256 rate_) external onlyOwner {
    strategyManager.updateStrategyFeeRate(rate_);
  }

  /**
   * @notice Updates the deductible rate for compensations
   * @param rate_ The new deductible rate in RAY
   */
  function updatePayoutDeductibleRate(
    uint256 rate_
  ) external onlyOwner {
    strategyManager.updatePayoutDeductibleRate(rate_);
  }

  /**
   * @notice Rescue and transfer tokens locked in the StrategyManager contract
   * @param token The address of the token
   * @param to The address of the recipient
   * @param amount The amount of token to transfer
   */
  function rescueTokens(
    address token,
    address to,
    uint256 amount
  ) external onlyOwner {
    strategyManager.rescueTokens(token, to, amount);
  }

  // ======= CLAIM MANAGER FUNCTIONS ======= //

  /**
   * @notice Changes the Kleros arbitration configuration.
   * @param klerosArbitrator_ The new Kleros arbitrator.
   * @param subcourtId_ The new subcourt ID.
   * @param nbOfJurors_ The new number of jurors.
   */
  function setKlerosConfiguration(
    IArbitrator klerosArbitrator_,
    uint256 subcourtId_,
    uint256 nbOfJurors_
  ) external onlyOwner {
    claimManager.setKlerosConfiguration(
      klerosArbitrator_,
      subcourtId_,
      nbOfJurors_
    );
  }

  /**
   * @notice Changes the amount of collateral required when opening a claim.
   * @param amount_ The new amount of collateral.
   */
  function setRequiredCollateral(uint256 amount_) external onlyOwner {
    claimManager.setRequiredCollateral(amount_);
  }

  /**
   * @notice Changes the periods for challenging and overruling a claim.
   * @param challengePeriod_ The new challenge period.
   * @param evidenceUploadPeriod_ The new evidence upload period.
   */
  function setPeriods(
    uint64 challengePeriod_,
    uint64 evidenceUploadPeriod_,
    uint64 overrulePeriod_
  ) external onlyOwner {
    claimManager.setPeriods(
      challengePeriod_,
      evidenceUploadPeriod_,
      overrulePeriod_
    );
  }

  /**
   * @notice Changes the address of the meta-evidence guardian.
   */
  function setEvidenceGuardian() external onlyOwner {
    claimManager.setEvidenceGuardian(evidenceGuardian);
  }

  /**
   * @notice Prevents new claims from being created with this claim manager.
   * @param courtClosed_ Whether the court is closed or not.
   */
  function setCourClosed(bool courtClosed_) external onlyOwner {
    claimManager.setCourClosed(courtClosed_);
  }

  /**
   * @notice Changes the base URI for the meta-evidence.
   * @param baseMetaEvidenceURI_ The new base URI for the meta-evidence.
   */
  function setBaseMetaEvidenceURI(
    string memory baseMetaEvidenceURI_
  ) external onlyOwner {
    claimManager.setBaseMetaEvidenceURI(baseMetaEvidenceURI_);
  }

  /**
   * @notice Allows the owner to overrule a claim that has been accepted by the court decision.
   * @param claimId_ The claim ID
   * @param punishClaimant_ Whether to punish the claimant by taking their deposit
   */
  function overruleClaim(
    uint256 claimId_,
    bool punishClaimant_
  ) external onlyOwner {
    claimManager.overrule(claimId_, punishClaimant_);
  }
}
