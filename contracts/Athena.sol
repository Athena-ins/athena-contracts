// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./AAVE/ILendingPoolAddressesProvider.sol";
import "./AAVE/ILendingPool.sol";

import "./interfaces/IAthena.sol";
import "./interfaces/IPositionsManager.sol";
import "./interfaces/IProtocolFactory.sol";
import "./interfaces/IProtocolPool.sol";
import "./interfaces/IStakedAten.sol";
import "./interfaces/IStakedAtenPolicy.sol";
import "./interfaces/IPolicyManager.sol";
import "./interfaces/IClaimManager.sol";
import "./interfaces/IVaultERC20.sol";
import "./interfaces/IPriceOracle.sol";

import "./libraries/RayMath.sol";
import "hardhat/console.sol";

contract Athena is IAthena, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  address public stablecoin;

  /// @dev AAVE LendingPoolAddressesProvider Interface
  IERC20 public atenTokenInterface;
  ILendingPoolAddressesProvider public aaveAddressesRegistryInterface;

  IPositionsManager public positionManagerInterface;
  IPolicyManager public policyManagerInterface;
  IClaimManager public claimManagerInterface;

  IStakedAten public stakedAtensGPInterface;
  IStakedAtenPolicy public stakedAtensPoInterface;

  IProtocolFactory public protocolFactoryInterface;
  IVaultERC20 public atensVaultInterface;
  IPriceOracle public priceOracleInterface;

  struct AtenFeeLevel {
    uint256 atenAmount;
    uint128 feeRate;
  }
  /// Available reward levels (10_000 = 100% APR)
  AtenFeeLevel[] public supplyFeeLevels;

  constructor(
    address stablecoinUsed_,
    address atenTokenAddress_,
    address aaveAddressesRegistry_
  ) {
    stablecoin = stablecoinUsed_;

    aaveAddressesRegistryInterface = ILendingPoolAddressesProvider(
      aaveAddressesRegistry_
    );
    atenTokenInterface = IERC20(atenTokenAddress_);

    address lendingPool = aaveAddressesRegistryInterface.getLendingPool();
    IERC20(stablecoin).safeApprove(lendingPool, type(uint256).max);
  }

  function initialize(
    address _positionManagerAddress,
    address _policyManagerAddress,
    address _claimManagerAddress,
    address _stakedAtensGP,
    address _stakedAtensPo,
    address _protocolFactory,
    address _atensVault,
    address _priceOracle
  ) external onlyOwner {
    positionManagerInterface = IPositionsManager(_positionManagerAddress);
    policyManagerInterface = IPolicyManager(_policyManagerAddress);
    claimManagerInterface = IClaimManager(_claimManagerAddress);

    stakedAtensGPInterface = IStakedAten(_stakedAtensGP);
    stakedAtensPoInterface = IStakedAtenPolicy(_stakedAtensPo);

    protocolFactoryInterface = IProtocolFactory(_protocolFactory);
    atensVaultInterface = IVaultERC20(_atensVault);
    priceOracleInterface = IPriceOracle(_priceOracle);
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
  error FeeGreaterThan100Percent();

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
    address ownerOfToken = positionManagerInterface.ownerOf(positionId_);
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

  function getPoolAddressById(uint128 poolId) public view returns (address) {
    return protocolFactoryInterface.getPoolAddress(poolId);
  }

  function getProtocol(uint128 poolId_)
    public
    view
    returns (ProtocolView memory)
  {
    IProtocolFactory.Protocol memory pool = protocolFactoryInterface.getPool(
      poolId_
    );

    (
      uint256 insuredCapital,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate,
      IProtocolPool.Formula memory computingConfig
    ) = IProtocolPool(pool.deployed).protocolInfo();

    string memory claimAgreement = claimManagerInterface.getProtocolAgreement(
      poolId_
    );

    return
      ProtocolView({
        name: pool.name,
        paused: pool.paused,
        claimsOngoing: pool.claimsOngoing,
        poolId: poolId_,
        deployed: pool.deployed,
        stablecoin: pool.stablecoin,
        insuredCapital: insuredCapital,
        availableCapacity: availableCapacity,
        utilizationRate: utilizationRate,
        premiumRate: premiumRate,
        computingConfig: computingConfig,
        claimAgreement: claimAgreement,
        commitDelay: pool.commitDelay
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

  /// -------- STAKING -------- ///

  /** @notice
   * Gets all the cover supply fee levels according to the amount of staked ATEN.
   * @return levels all the fee levels
   **/
  function getAtenStakingFeeLevels()
    public
    view
    returns (AtenFeeLevel[] memory levels)
  {
    uint256 nbLevels = supplyFeeLevels.length;
    levels = new AtenFeeLevel[](nbLevels);

    for (uint256 i = 0; i < nbLevels; i++) {
      levels[i] = supplyFeeLevels[i];
    }
  }

  /** @notice
   * Retrieves the fee rate according to amount of staked ATEN.
   * @dev Returns displays warning but levels require an amountAten of 0
   * @param stakedAten_ amount of ATEN the user stakes in GP
   * @return _ amount of fees applied to cover supply interests
   **/
  function getFeeRateWithAten(uint256 stakedAten_)
    public
    view
    override
    returns (uint128)
  {
    // Lazy check to avoid loop if user doesn't stake
    if (stakedAten_ == 0) return supplyFeeLevels[0].feeRate;

    // Inversed loop starts with the end to find adequate level
    for (uint256 index = supplyFeeLevels.length - 1; index >= 0; index--) {
      // Rate level with atenAmount of 0 will always be true
      if (supplyFeeLevels[index].atenAmount <= stakedAten_)
        return supplyFeeLevels[index].feeRate;
    }
  }

  /// ========================== ///
  /// ========= HELPERS ======== ///
  /// ========================== ///

  function actualizingProtocolAndRemoveExpiredPolicies(address protocolAddress)
    public
    override
  {
    uint256[] memory __expiredTokens = IProtocolPool(protocolAddress)
      .actualizing();

    policyManagerInterface.processExpiredTokens(__expiredTokens);
    stakedAtensPoInterface.endStakingPositions(__expiredTokens);
  }

  function actualizingProtocolAndRemoveExpiredPoliciesByPoolId(uint128 poolId_)
    public
  {
    actualizingProtocolAndRemoveExpiredPolicies(getPoolAddressById(poolId_));
  }

  function _transferLiquidityToAAVE(uint256 amount) private returns (uint256) {
    address lendingPool = aaveAddressesRegistryInterface.getLendingPool();

    ILendingPool(lendingPool).deposit(stablecoin, amount, address(this), 0);

    return
      amount.rayDiv(
        ILendingPool(lendingPool).getReserveNormalizedIncome(stablecoin)
      );
  }

  function _updateUserPositionFeeRate(address account_) private {
    // Check if user has positions that will require an update
    uint256[] memory tokenList = positionManagerInterface
      .allPositionTokensOfOwner(account_);

    // If the user has positions check if unstaking affects fee level
    if (tokenList.length != 0) {
      // Get the user's first position
      IPositionsManager.Position memory userPosition = positionManagerInterface
        .position(tokenList[0]);
      uint128 currentFeeLevel = userPosition.feeRate;

      // Check the user's balance of staked ATEN + staking rewards
      uint256 newbalance = stakedAtensGPInterface.positionOf(account_);

      // Compute the fee level after adding accrued interests and removing withdrawal
      uint128 newFeeLevel = getFeeRateWithAten(newbalance);

      // If the fee level changes, update all positions
      if (currentFeeLevel != newFeeLevel) {
        for (uint256 i = 0; i < tokenList.length; i++) {
          positionManagerInterface.takeInterestsInAllPools(
            account_,
            tokenList[i]
          );

          positionManagerInterface.updateFeeLevel(tokenList[i], newFeeLevel);
        }
      }
    }
  }

  function _prepareCoverUpdate(uint256 coverId_)
    private
    returns (address poolAddress)
  {
    uint128 poolId = policyManagerInterface.poolIdOfPolicy(coverId_);
    poolAddress = getPoolAddressById(poolId);
    actualizingProtocolAndRemoveExpiredPolicies(poolAddress);
  }

  /// ===================================== ///
  /// ========== ATEN GP STAKING ========== ///
  /// ===================================== ///

  /** @notice
   * Stake ATEN in the general staking pool to earn interests.
   * @dev Also updates covers if the update causes a fee level change
   * @param amount_ the amount of ATEN to stake
   **/
  function stakeAtens(uint256 amount_) external override {
    // Deposit ATEN in the staking pool
    stakedAtensGPInterface.stake(msg.sender, amount_);
    atenTokenInterface.safeTransferFrom(
      msg.sender,
      address(stakedAtensGPInterface),
      amount_
    );

    _updateUserPositionFeeRate(msg.sender);
  }

  /** @notice
   * Distributes the profits generated by a user's staking position.
   */
  function takeStakingProfits() external {
    uint256 amountRewards = stakedAtensGPInterface.claimRewards(msg.sender);

    // Send the rewards to the user from the vault
    atensVaultInterface.sendStakingReward(msg.sender, amountRewards);
  }

  /** @notice
   * Remove ATEN from the general staking pool.
   * @dev Also updates covers if the update causes a fee level change
   * @param amount_ the amount of ATEN to withdraw
   **/
  function unstakeAtens(uint256 amount_) external {
    // Withdraw from the staking pool
    stakedAtensGPInterface.withdraw(msg.sender, amount_);
    atenTokenInterface.safeTransferFrom(
      address(stakedAtensGPInterface),
      msg.sender,
      amount_
    );

    _updateUserPositionFeeRate(msg.sender);
  }

  /// ============================ ///
  /// ========== COVERS ========== ///
  /// ============================ ///

  function deposit(uint256 amount, uint128[] calldata poolIds) public {
    // Check if the poolIds do not include incompatible pools
    protocolFactoryInterface.validePoolIds(poolIds);

    // retrieve user funds for coverage
    IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), amount);

    // Deposit the funds into AAVE and get the new scaled balance
    uint256 newAaveScaledBalance = _transferLiquidityToAAVE(amount);

    // Check the user's balance of staked ATEN + staking rewards
    uint256 stakedAten = stakedAtensGPInterface.positionOf(msg.sender);

    // If user has staked ATEN then get feeRate
    uint128 stakingFeeRate;
    if (stakedAten > 0) {
      stakingFeeRate = getFeeRateWithAten(stakedAten);
    }

    // deposit assets in the pool and create position NFT
    positionManagerInterface.deposit(
      msg.sender,
      amount,
      newAaveScaledBalance,
      stakingFeeRate,
      poolIds
    );

    // Check if his staking reward rate needs to be updated
    stakedAtensGPInterface.updateUserRewardRate(msg.sender);
  }

  function takeInterest(uint256 tokenId, uint128 poolId)
    public
    onlyPositionTokenOwner(tokenId)
  {
    positionManagerInterface.takeInterest(msg.sender, tokenId, poolId);
  }

  function takeInterestInAllPools(uint256 tokenId)
    public
    onlyPositionTokenOwner(tokenId)
  {
    positionManagerInterface.takeInterestsInAllPools(msg.sender, tokenId);
  }

  function addLiquidityToPosition(uint256 tokenId, uint256 amount)
    external
    onlyPositionTokenOwner(tokenId)
  {
    // retrieve user funds for coverage
    IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), amount);

    // Deposit the funds into AAVE and get the new scaled balance
    uint256 newAaveScaledBalance = _transferLiquidityToAAVE(amount);

    // check the user's balance of staked ATEN + staking rewards
    uint256 stakedAten = stakedAtensGPInterface.positionOf(msg.sender);

    // if user has staked ATEN then get feeRate
    uint128 newStakingFeeRate;
    if (stakedAten > 0) {
      newStakingFeeRate = getFeeRateWithAten(stakedAten);
    }

    positionManagerInterface.updatePosition(
      msg.sender,
      tokenId,
      amount,
      newAaveScaledBalance,
      newStakingFeeRate
    );

    // Check if his staking reward rate needs to be updated
    stakedAtensGPInterface.updateUserRewardRate(msg.sender);
  }

  function committingWithdrawAll(uint256 tokenId)
    external
    onlyPositionTokenOwner(tokenId)
  {
    uint256 userBalance = positionManagerInterface.balanceOf(msg.sender);
    if (userBalance == 0) revert UserHasNoPositions();

    IPositionsManager.Position memory __position = positionManagerInterface
      .position(tokenId);

    // @bw committingWithdrawLiquidity should be saved in the core instead of each pool
    for (uint256 index = 0; index < __position.poolIds.length; index++)
      IProtocolPool(getPoolAddressById(__position.poolIds[index]))
        .committingWithdrawLiquidity(tokenId);
  }

  function withdrawAll(uint256 tokenId)
    external
    onlyPositionTokenOwner(tokenId)
  {
    IPositionsManager.Position memory __position = positionManagerInterface
      .position(tokenId);

    uint256 __newUserCapital;
    uint256 __aaveScaledBalanceToRemove;
    for (uint256 index = 0; index < __position.poolIds.length; index++) {
      IProtocolPool __protocol = IProtocolPool(
        getPoolAddressById(__position.poolIds[index])
      );

      // @bw should check commit delay elapsed in this contract to avoid multiple calls to the protocols
      bool delayElapsed = __protocol.isWithdrawLiquidityDelayOk(tokenId);
      if (delayElapsed != true) revert WithdrawCommitDelayNotReached();

      __protocol.removeCommittedWithdrawLiquidity(tokenId);

      actualizingProtocolAndRemoveExpiredPolicies(address(__protocol));

      (__newUserCapital, __aaveScaledBalanceToRemove) = __protocol
        .withdrawLiquidity(
          msg.sender,
          tokenId,
          __position.amountSupplied,
          __position.poolIds,
          __position.feeRate
        );

      __protocol.removeLPInfo(tokenId);
    }

    positionManagerInterface.burn(tokenId);

    address __lendingPool = aaveAddressesRegistryInterface.getLendingPool();

    ILendingPool lendingPoolInterface = ILendingPool(__lendingPool);

    uint256 _amountToWithdrawFromAAVE = __position.aaveScaledBalance.rayMul(
      lendingPoolInterface.getReserveNormalizedIncome(stablecoin)
    );

    lendingPoolInterface.withdraw(
      stablecoin,
      _amountToWithdrawFromAAVE,
      msg.sender
    );

    // Check if his staking reward rate needs to be updated
    stakedAtensGPInterface.updateUserRewardRate(msg.sender);
  }

  /// ============================== ///
  /// ========== POLICIES ========== ///
  /// ============================== ///

  //////Thao@NOTE: Policy
  function buyPolicies(
    uint256[] calldata amountCoveredArray_,
    uint256[] calldata premiumDepositArray_,
    uint256[] calldata atensLockedArray_,
    uint128[] calldata poolIdArray_
  ) public nonReentrant {
    uint256 nbPolicies = poolIdArray_.length;

    for (uint256 i = 0; i < nbPolicies; i++) {
      uint256 _amountCovered = amountCoveredArray_[i];
      uint256 _premiumDeposit = premiumDepositArray_[i];
      uint256 _atensLocked = atensLockedArray_[i];
      uint128 _poolId = poolIdArray_[i];

      if (_amountCovered == 0 || _premiumDeposit == 0)
        revert AmountEqualToZero();

      address poolAddress = getPoolAddressById(_poolId);

      IERC20(stablecoin).safeTransferFrom(
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

      if (0 < _atensLocked) {
        // Get tokens from user to staking pool
        // @bw send in one go after checks are passed instead of multiple transfers
        atenTokenInterface.safeTransferFrom(
          msg.sender,
          address(stakedAtensPoInterface),
          _atensLocked
        );
        stakedAtensPoInterface.createStakingPosition(coverId, _atensLocked);
      }
    }
  }

  /// -------- COVER UPDATE -------- ///

  // @bw need update cover
  function increaseCover(uint256 coverId_, uint256 amount_)
    external
    onlyPolicyTokenOwner(coverId_)
  {
    address poolAddress = _prepareCoverUpdate(coverId_);
    policyManagerInterface.increaseCover(coverId_, amount_);
    IProtocolPool(poolAddress).increaseCover(coverId_, amount_);
  }

  function decreaseCover(uint256 coverId_, uint256 amount_)
    external
    onlyPolicyTokenOwner(coverId_)
  {
    address poolAddress = _prepareCoverUpdate(coverId_);
    policyManagerInterface.decreaseCover(coverId_, amount_);
    IProtocolPool(poolAddress).decreaseCover(coverId_, amount_);
  }

  function addPremiums(uint256 coverId_, uint256 amount_)
    external
    onlyPolicyTokenOwner(coverId_)
  {
    address poolAddress = _prepareCoverUpdate(coverId_);

    IERC20(stablecoin).safeTransferFrom(msg.sender, poolAddress, amount_);

    stakedAtensPoInterface.updateBeforePremiumChange(coverId_);
    policyManagerInterface.addPremiums(coverId_, amount_);
    IProtocolPool(poolAddress).addPremiums(coverId_, amount_);
  }

  function removePremiums(uint256 coverId_, uint256 amount_)
    external
    onlyPolicyTokenOwner(coverId_)
  {
    address poolAddress = _prepareCoverUpdate(coverId_);

    stakedAtensPoInterface.updateBeforePremiumChange(coverId_);
    policyManagerInterface.removePremiums(coverId_, amount_);
    IProtocolPool(poolAddress).removePremiums(coverId_, amount_, msg.sender);
  }

  /// -------- CLOSE -------- ///

  /**
   * @notice
   * Closes the policy of a user and withdraws remaining funds, staked ATEN and potential staking rewards.
   * @param policyId_ id of the policy to close
   */
  function withdrawPolicy(uint256 policyId_)
    public
    onlyPolicyTokenOwner(policyId_)
    nonReentrant
  {
    // Get the policy
    IPolicyManager.Policy memory userPolicy = policyManagerInterface.policy(
      policyId_
    );
    address poolAddress = getPoolAddressById(userPolicy.poolId);

    // Remove expired policies
    actualizingProtocolAndRemoveExpiredPolicies(poolAddress);

    // Require that the policy is still active
    bool isStillActive = policyManagerInterface.policyActive(policyId_);
    if (isStillActive != true) revert PolicyExpired();

    // The cover refund pool will close the position if it exists
    closeCoverRefundPosition(policyId_);

    // Updates pool liquidity and withdraws remaining funds to user
    IProtocolPool(poolAddress).withdrawPolicy(
      msg.sender,
      policyId_,
      userPolicy.amountCovered
    );

    // Expire the cover of the user
    policyManagerInterface.expireCover(policyId_, true);
  }

  /// -------- COVER REFUND -------- ///

  function addToCoverRefundStake(uint256 coverId_, uint256 amount_)
    external
    onlyPolicyTokenOwner(coverId_)
  {
    // Core contracts is responsible for incoming tokens
    atenTokenInterface.safeTransferFrom(
      msg.sender,
      address(stakedAtensPoInterface),
      amount_
    );
    stakedAtensPoInterface.addToStake(coverId_, amount_);
  }

  function withdrawCoverRefundStakedAten(uint256 coverId_, uint256 amount_)
    external
    onlyPolicyTokenOwner(coverId_)
  {
    // Cover refund contracts is responsible for outgoing tokens
    stakedAtensPoInterface.withdrawStakedAten(coverId_, amount_, msg.sender);
  }

  /**
   * @notice
   * Allows a user to withdraw cover refund rewards.
   * @param policyId_ the id of the policy position
   */
  function withdrawCoverRefundRewards(uint256 policyId_)
    external
    onlyPolicyTokenOwner(policyId_)
  {
    // Update the cover refund position and retrieve the net rewards
    uint256 netRewards = stakedAtensPoInterface.withdrawRewards(policyId_);
    if (0 < netRewards) {
      atensVaultInterface.sendCoverRefundReward(msg.sender, netRewards);
    }
  }

  /**
   * @notice
   * Closes a cover refund position while returning staked ATEN and distributing earned rewards.
   * @param policyId_ the id of the policy position
   */
  function closeCoverRefundPosition(uint256 policyId_)
    public
    onlyPolicyTokenOwner(policyId_)
  {
    // Update the cover refund position and retrieve the net rewards
    uint256 netRewards = stakedAtensPoInterface.closePosition(
      policyId_,
      msg.sender
    );
    if (0 < netRewards) {
      atensVaultInterface.sendCoverRefundReward(msg.sender, netRewards);
    }
  }

  /**
   * @notice
   * Closes multiple cover refund positions while returning staked ATEN and distributing earned rewards.
   * @param policyIds_ the ids of the policy positions
   */
  function closeMultiCoverRefundPositions(uint256[] calldata policyIds_)
    external
  {
    uint256 totalNetRewards;

    for (uint256 i = 0; i < policyIds_.length; i++) {
      uint256 coverId = policyIds_[i];

      address ownerOfToken = policyManagerInterface.ownerOf(coverId);
      if (msg.sender != ownerOfToken) revert NotPolicyOwner();

      totalNetRewards += stakedAtensPoInterface.closePosition(
        coverId,
        msg.sender
      );
    }

    if (0 < totalNetRewards) {
      atensVaultInterface.sendCoverRefundReward(msg.sender, totalNetRewards);
    }
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
    IPolicyManager.Policy memory userPolicy = policyManagerInterface.policy(
      policyId_
    );

    address poolAddress = getPoolAddressById(userPolicy.poolId);

    IProtocolPool poolInterface = IProtocolPool(poolAddress);
    uint256 ratio = poolInterface.ratioWithAvailableCapital(amount_);

    ILendingPool lendingPoolInterface = ILendingPool(
      aaveAddressesRegistryInterface.getLendingPool()
    );

    uint256 reserveNormalizedIncome = lendingPoolInterface
      .getReserveNormalizedIncome(stablecoin);

    uint128[] memory relatedProtocols = poolInterface.getRelatedProtocols();
    for (uint256 i = 0; i < relatedProtocols.length; i++) {
      uint128 relatedPoolId = relatedProtocols[i];

      address relatedPoolAddress = getPoolAddressById(relatedPoolId);

      actualizingProtocolAndRemoveExpiredPolicies(relatedPoolAddress);

      IProtocolPool(relatedPoolAddress).processClaim(
        userPolicy.poolId,
        ratio,
        reserveNormalizedIncome
      );
    }

    lendingPoolInterface.withdraw(stablecoin, amount_, account_);

    //Thao@TODO: enable next line when adding modifier 'onlyClaimManager' and calling startClaim to increment claimsOngoing before resolve
    // @bw is this necessary ?
    // getPoolAddressById(__poolId].claimsOngoing -= 1;
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  /// -------- STAKING -------- ///

  /** @notice
   * Set the fee levels on cover interests according to amount of staked ATEN in general pool.
   * @dev Levels must be in ascending order of atenAmount
   * @dev The atenAmount indicates the upper limit for the level
   * @param levels_ array of fee level structs
   **/
  function setFeeLevelsWithAten(AtenFeeLevel[] calldata levels_)
    public
    onlyOwner
  {
    // First clean the storage
    delete supplyFeeLevels;

    // Set all cover supply fee levels
    uint256 previousAtenAmount = 0;
    for (uint256 index = 0; index < levels_.length; index++) {
      AtenFeeLevel calldata level = levels_[index];

      if (index == 0) {
        // Require that the first level indicates fees for atenAmount 0
        if (level.atenAmount != 0) revert MissingBaseRate();
      } else {
        // If it isn't the first item check that items are ascending
        if (level.atenAmount < previousAtenAmount)
          revert MustSortInAscendingOrder();
        previousAtenAmount = level.atenAmount;
      }

      // Check that APR is not higher than 100%
      if (10_000 < level.feeRate) revert FeeGreaterThan100Percent();

      // save to storage
      supplyFeeLevels.push(level);
    }
  }

  function setStakingRewardRates(
    IStakedAten.RewardRateLevel[] calldata stakingLevels_
  ) external onlyOwner {
    stakedAtensGPInterface.setStakingRewards(stakingLevels_);
  }

  /// -------- PROTOCOL POOLS -------- ///

  function addNewProtocol(
    string calldata name_,
    uint128[] calldata incompatiblePools_,
    uint128 commitDelay_,
    string calldata ipfsAgreementCid_,
    uint256 uOptimal_,
    uint256 r0_,
    uint256 rSlope1_,
    uint256 rSlope2_
  ) public onlyOwner {
    uint128 poolId = protocolFactoryInterface.deployProtocol(
      stablecoin,
      name_,
      incompatiblePools_,
      commitDelay_,
      uOptimal_,
      r0_,
      rSlope1_,
      rSlope2_
    );

    // Add the meta evidence IPFS address to the registry
    claimManagerInterface.addAgreementForProtocol(poolId, ipfsAgreementCid_);
  }

  /// -------- AAVE -------- ///

  function setAAVEAddressesRegistry(address aaveAddressesRegistry_)
    external
    onlyOwner
  {
    aaveAddressesRegistryInterface = ILendingPoolAddressesProvider(
      aaveAddressesRegistry_
    );
  }
}
