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

contract Athena is IAthena, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  mapping(uint128 => mapping(uint128 => bool)) public incompatibilityProtocols;
  mapping(uint128 => Protocol) public protocolsMapping;

  address public stablecoin;
  /// @dev AAVE LendingPoolAddressesProvider Interface
  ILendingPoolAddressesProvider public aaveAddressesRegistryInterface;
  address public protocolFactory;
  IPositionsManager public positionManagerInterface;
  IPolicyManager public policyManagerInterface;
  IClaimManager public claimManagerInterface;

  /// @notice Staking Pool Contract: General Pool (GP)
  IStakedAten public stakedAtensGPInterface;
  /// @notice Staking Pool Contract: Policy
  IStakedAtenPolicy public stakedAtensPoInterface;
  address public atenToken;
  address public atensVault;

  struct AtenFeeLevel {
    uint256 atenAmount;
    uint128 feeRate;
  }

  /// Available reward levels (10_000 = 100% APR)
  AtenFeeLevel[] public supplyFeeLevels;

  uint128 public override nextPoolId;

  struct ProtocolView {
    string name;
    uint128 poolId;
    uint256 insuredCapital;
    uint256 availableCapacity;
    uint256 utilizationRate;
    uint256 premiumRate;
    IProtocolPool.Formula computingConfig;
    string claimAgreement;
  }

  constructor(
    address stablecoinUsed_,
    address atenTokenAddress_,
    address aaveAddressesRegistry_
  ) {
    atenToken = atenTokenAddress_;
    stablecoin = stablecoinUsed_;
    aaveAddressesRegistryInterface = ILendingPoolAddressesProvider(
      aaveAddressesRegistry_
    );

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
    address _atensVault
  ) external onlyOwner {
    positionManagerInterface = IPositionsManager(_positionManagerAddress);
    policyManagerInterface = IPolicyManager(_policyManagerAddress);
    claimManagerInterface = IClaimManager(_claimManagerAddress);

    stakedAtensGPInterface = IStakedAten(_stakedAtensGP);
    stakedAtensPoInterface = IStakedAtenPolicy(_stakedAtensPo);

    protocolFactory = _protocolFactory;
    atensVault = _atensVault;
    // @bw do we keep it upgradable ?
    //initialized = true;
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

  //////Thao@NOTE: LP
  modifier validePoolIds(uint128[] calldata poolIds) {
    for (uint256 firstIndex = 0; firstIndex < poolIds.length; firstIndex++) {
      Protocol memory firstProtocol = protocolsMapping[poolIds[firstIndex]];

      if (firstProtocol.active != true) revert ProtocolIsInactive();

      for (
        uint256 secondIndex = firstIndex + 1;
        secondIndex < poolIds.length;
        secondIndex++
      ) {
        if (poolIds[firstIndex] == poolIds[secondIndex]) revert SamePoolIds();

        bool isIncompatible = incompatibilityProtocols[poolIds[firstIndex]][
          poolIds[secondIndex]
        ];
        bool isIncompatibleReverse = incompatibilityProtocols[
          poolIds[secondIndex]
        ][poolIds[firstIndex]];

        if (isIncompatible == true || isIncompatibleReverse == true)
          revert IncompatibleProtocol(firstIndex, secondIndex);
      }
    }

    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function getProtocolAddressById(uint128 poolId)
    external
    view
    override
    returns (address)
  {
    return protocolsMapping[poolId].deployed;
  }

  function getProtocol(uint128 poolId)
    public
    view
    returns (ProtocolView memory)
  {
    if (nextPoolId <= poolId) revert OutOfRange();

    address poolAddress = protocolsMapping[poolId].deployed;

    (
      uint256 insuredCapital,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate,
      IProtocolPool.Formula memory computingConfig
    ) = IProtocolPool(poolAddress).protocolInfo();

    string memory claimAgreement = claimManagerInterface.getProtocolAgreement(
      poolId
    );

    return
      ProtocolView(
        protocolsMapping[poolId].name,
        poolId,
        insuredCapital,
        availableCapacity,
        utilizationRate,
        premiumRate,
        computingConfig,
        claimAgreement
      );
  }

  function getAllProtocols()
    external
    view
    returns (ProtocolView[] memory protocols)
  {
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

  //Thao@WARN: also removing atensLocked !!!
  function actualizingProtocolAndRemoveExpiredPolicies(address protocolAddress)
    public
    override
  {
    uint256[] memory __expiredTokens = IProtocolPool(protocolAddress)
      .actualizing();

    policyManagerInterface.processExpiredTokens(__expiredTokens);
  }

  function actualizingProtocolAndRemoveExpiredPoliciesByPoolId(uint128 poolId_)
    public
  {
    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[poolId_].deployed
    );
  }

  function _transferLiquidityToAAVE(uint256 amount) private returns (uint256) {
    address lendingPool = aaveAddressesRegistryInterface.getLendingPool();

    ILendingPool(lendingPool).deposit(stablecoin, amount, address(this), 0);

    return
      amount.rayDiv(
        ILendingPool(lendingPool).getReserveNormalizedIncome(stablecoin)
      );
  }

  /**
   * @notice
   * Manages the withdrawal of staked ATEN in policy pool and rewards payment.
   * @param account_ the address of the user
   * @param policyId_ the id of the policy position
   */
  function _processPolicyStakingPayout(address account_, uint256 policyId_)
    private
  {
    // Get the amount of rewards, consume the staking position and send back staked ATEN to user
    uint256 amountRewards = stakedAtensPoInterface.withdraw(
      account_,
      policyId_
    );

    // Check the amount is above 0
    if (amountRewards == 0) revert WithdrawableAmountIsZero();

    // Send the rewards to the user from the vault
    IVaultERC20(atensVault).sendReward(account_, amountRewards);
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
    IERC20(atenToken).safeTransferFrom(
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
    IVaultERC20(atensVault).sendReward(msg.sender, amountRewards);
  }

  /** @notice
   * Remove ATEN from the general staking pool.
   * @dev Also updates covers if the update causes a fee level change
   * @param amount_ the amount of ATEN to withdraw
   **/
  function unstakeAtens(uint256 amount_) external {
    // Withdraw from the staking pool
    stakedAtensGPInterface.withdraw(msg.sender, amount_);
    IERC20(atenToken).safeTransferFrom(
      address(stakedAtensGPInterface),
      msg.sender,
      amount_
    );

    _updateUserPositionFeeRate(msg.sender);
  }

  /// ============================ ///
  /// ========== COVERS ========== ///
  /// ============================ ///

  function deposit(uint256 amount, uint128[] calldata poolIds)
    public
    payable
    validePoolIds(poolIds)
  {
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
      IProtocolPool(protocolsMapping[__position.poolIds[index]].deployed)
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
        protocolsMapping[__position.poolIds[index]].deployed
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
  ) public payable nonReentrant {
    uint256 nbPolicies = poolIdArray_.length;

    for (uint256 i = 0; i < nbPolicies; i++) {
      uint256 _amountCovered = amountCoveredArray_[i];
      uint256 _premiumDeposit = premiumDepositArray_[i];
      uint256 _atensLocked = atensLockedArray_[i];
      uint128 _poolId = poolIdArray_[i];

      if (_amountCovered == 0 || _premiumDeposit == 0)
        revert AmountEqualToZero();

      IERC20(stablecoin).safeTransferFrom(
        msg.sender,
        protocolsMapping[_poolId].deployed,
        _premiumDeposit
      );

      uint256 policyId = policyManagerInterface.mint(
        msg.sender,
        _amountCovered,
        _premiumDeposit,
        _atensLocked,
        _poolId
      );

      actualizingProtocolAndRemoveExpiredPolicies(
        protocolsMapping[_poolId].deployed
      );

      IProtocolPool(protocolsMapping[_poolId].deployed).buyPolicy(
        msg.sender,
        policyId,
        _premiumDeposit,
        _amountCovered
      );

      if (_atensLocked > 0) {
        // @bw TODO get oracle price !
        uint256 pricePrecision = 10000;
        uint256 __price = 100; // = 100 / 10.000 = 0.01 USDT
        uint256 __decimalsRatio = 1e18 / 10**ERC20(stablecoin).decimals();

        if (
          (_premiumDeposit * __decimalsRatio) <
          (__price * _atensLocked) / pricePrecision
        ) revert AmountAtenTooHigh();

        // Get tokens from user to staking pool
        // @bw send in one go after checks are passed instead of multiple transfers
        IERC20(atenToken).safeTransferFrom(
          msg.sender,
          address(stakedAtensPoInterface),
          _atensLocked
        );
        stakedAtensPoInterface.stake(msg.sender, policyId, _atensLocked);
      }
    }
  }

  /**
   * @notice
   * Closes the policy of a user and withdraws remaining funds, staked ATEN and potential staking rewards.
   * @param policyId_ id of the policy to close
   */
  function withdrawPolicy(uint256 policyId_)
    public
    payable
    onlyPolicyTokenOwner(policyId_)
    nonReentrant
  {
    // Get the policy
    IPolicyManager.Policy memory userPolicy = policyManagerInterface.policy(
      policyId_
    );

    // Remove expired policies
    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[userPolicy.poolId].deployed
    );

    // Require that the policy is still active
    // @bw maybe wrong fn for checking
    bool isStillActive = policyManagerInterface.policyActive(policyId_);
    if (isStillActive != true) revert PolicyExpired();

    // If ATEN was staked along with the policy then process the staking withdrawal
    if (0 < userPolicy.atensLocked) {
      if (userPolicy.beginCoveredTime + 365 days <= block.timestamp) {
        // If a year has elapsed then consume staking position and withdraw ATEN + rewards
        _processPolicyStakingPayout(msg.sender, policyId_);
      } else {
        // If a year has not elapsed then consume staking position and withdraw ATEN
        stakedAtensPoInterface.earlyWithdraw(msg.sender, policyId_);
      }
    }

    // Updates pool liquidity and withdraws remaining funds to user
    uint256 _premiumLeft = IProtocolPool(
      protocolsMapping[userPolicy.poolId].deployed
    ).withdrawPolicy(msg.sender, userPolicy.amountCovered);

    uint256 premiumSpent = userPolicy.premiumDeposit - _premiumLeft;

    // Delete policy from registry and saves historical data
    policyManagerInterface.saveExpiredPolicy(
      msg.sender,
      policyId_,
      userPolicy,
      premiumSpent,
      true
    );

    policyManagerInterface.burn(policyId_);
  }

  /**
   * @notice
   * Enables ATEN withdrawals from policy staking pool either with anticipation or from expired policies.
   * @param policyId_ the id of the policy position
   */
  function withdrawAtensPolicyWithoutRewards(uint256 policyId_)
    external
    onlyPolicyTokenOwner(policyId_)
  {
    // Consume the staking position and send back staked ATEN to user
    stakedAtensPoInterface.earlyWithdraw(msg.sender, policyId_);
  }

  /**
   * @notice
   * Withdraws the staking rewards generated from a policy staking position.
   * @param policyId_ the id of the policy position
   */
  function withdrawAtensPolicy(uint256 policyId_)
    public
    onlyPolicyTokenOwner(policyId_)
  {
    // Get the protocol ID of the policy
    uint128 poolId = policyManagerInterface.poolIdOfPolicy(policyId_);

    // Remove expired policies
    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[poolId].deployed
    );

    // Require that the policy is still active
    // @bw maybe wrong fn for checking
    // @bw no need to be active, no fn for exit post expiration
    // withdrawAtensPolicyWithoutRewards should not remove rewards if expired post 1 year
    bool isStillActive = policyManagerInterface.policyActive(policyId_);
    if (isStillActive != true) revert PolicyExpired();

    // Process withdrawal and rewards payment
    _processPolicyStakingPayout(msg.sender, policyId_);
  }

  /**
   * @notice
   * Withdraws ATEN and policy staking rewards from multiple policy staking positions.
   * @param policyIds_ the ids of the policy positions
   */
  function withdrawAllAtensFromPolicies(uint256[] calldata policyIds_)
    external
  {
    uint256 policyIdLength = policyIds_.length;
    for (uint256 i = 0; i < policyIdLength; i++) {
      withdrawAtensPolicy(policyIds_[i]);
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

    address poolAddress = protocolsMapping[userPolicy.poolId].deployed;

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

      address relatedPoolAddress = protocolsMapping[relatedPoolId].deployed;

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
    // protocolsMapping[__poolId].claimsOngoing -= 1;
  }

  /// =========================== ///
  /// ========== ADMIN ========== ///
  /// =========================== ///

  /// -------- STAKING -------- ///

  function depositRewardForPolicyStaking(uint256 amount_) external onlyOwner {
    // Transfer the ATEN to the vault
    IERC20(atenToken).safeTransferFrom(msg.sender, atensVault, amount_);

    // Make the rewards available to users by registering it in the staking pool
    stakedAtensPoInterface.addAvailableRewards(amount_);
  }

  /**
   * @notice
   * Sets the APR applied to newly created policies that stake ATEN in the policy staking pool.
   * @param newRate_ the new reward rate (100% APR = 10_000)
   */
  function setPolicyStakingRewards(uint128 newRate_) external onlyOwner {
    stakedAtensPoInterface.setRewardsPerYear(newRate_);
  }

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
    string calldata name,
    uint8 premiumRate, //Thao@NOTE: not used
    uint128[] calldata protocolsNotCompat,
    string calldata ipfsAgreementCid_
  ) public onlyOwner {
    uint128 newPoolId = nextPoolId;
    nextPoolId++;

    address _protocolDeployed = IProtocolFactory(protocolFactory)
      .deployProtocol(stablecoin, newPoolId, 75 * 1e27, 1e27, 5e27, 11e26);

    // Add the meta evidence IPFS address to the registry
    claimManagerInterface.addAgreementForProtocol(newPoolId, ipfsAgreementCid_);

    protocolsMapping[newPoolId] = Protocol({
      id: newPoolId,
      name: name,
      premiumRate: premiumRate,
      deployed: _protocolDeployed,
      active: true,
      claimsOngoing: 0
    });

    for (uint256 i = 0; i < protocolsNotCompat.length; i++) {
      incompatibilityProtocols[newPoolId][protocolsNotCompat[i]] = true;
    }

    emit NewProtocol(newPoolId);
  }

  // @bw unused
  function pauseProtocol(uint128 poolId, bool pause) external onlyOwner {
    protocolsMapping[poolId].active = pause;
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
