// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

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
import "./interfaces/IScaledBalanceToken.sol";
import "./interfaces/IClaimManager.sol";
import "./interfaces/IVaultERC20.sol";

contract Athena is IAthena, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  mapping(uint128 => mapping(uint128 => bool)) public incompatibilityProtocols;
  mapping(uint128 => Protocol) public protocolsMapping;

  address public stablecoin;
  address public aaveAddressesRegistry; // AAVE lending pool
  address public protocolFactory;
  address public positionsManager;
  address public override policyManager;
  address public claimManager;

  /// @notice Staking Pool Contract: General Pool (GP)
  address public stakedAtensGP;
  /// @notice Staking Pool Contract: Policy
  address public stakedAtensPo;
  address public rewardsToken;
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
  }

  constructor(
    address _stablecoinUsed,
    address _rewardsToken,
    address _aaveAddressesRegistry
  ) {
    rewardsToken = _rewardsToken;
    stablecoin = _stablecoinUsed;
    aaveAddressesRegistry = _aaveAddressesRegistry;
  }

  function initialize(
    address _positionsAddress,
    address _stakedAtensGP,
    address _stakedAtensPo,
    address _atensVault,
    address _policyManagerAddress,
    address _protocolFactory,
    address _claimManager
  ) external onlyOwner {
    positionsManager = _positionsAddress;
    stakedAtensGP = _stakedAtensGP;
    stakedAtensPo = _stakedAtensPo;
    policyManager = _policyManagerAddress;
    protocolFactory = _protocolFactory;

    claimManager = _claimManager;
    atensVault = _atensVault;
    approveLendingPool();
    //initialized = true; //@dev required ?
  }

  /// ========================= ///
  /// ========= EVENTS ======== ///
  /// ========================= ///

  event NewProtocol(uint128);

  /// ============================ ///
  /// ========= MODIFIERS ======== ///
  /// ============================ ///

  modifier onlyClaimManager() {
    require(msg.sender == claimManager, "Only Claim Manager");
    _;
  }

  /**
   * @notice
   * Check caller is owner of the position supply NFT
   * @param positionId_ position supply NFT ID
   */
  modifier onlyPositionTokenOwner(uint256 positionId_) {
    address ownerOfToken = IPositionsManager(positionsManager).ownerOf(
      positionId_
    );
    require(msg.sender == ownerOfToken, "A: not position owner");
    _;
  }

  /**
   * @notice
   * Check caller is owner of the policy holder NFT
   * @param policyId_ policy holder NFT ID
   */
  modifier onlyPolicyTokenOwner(uint256 policyId_) {
    address ownerOfToken = IPolicyManager(policyManager).ownerOf(policyId_);
    require(msg.sender == ownerOfToken, "A: not policy owner");
    _;
  }

  //////Thao@NOTE: LP
  modifier validePoolIds(uint128[] calldata poolIds) {
    for (uint256 firstIndex = 0; firstIndex < poolIds.length; firstIndex++) {
      Protocol memory firstProtocol = protocolsMapping[poolIds[firstIndex]];
      require(firstProtocol.active == true, "PA");

      for (
        uint256 secondIndex = firstIndex + 1;
        secondIndex < poolIds.length;
        secondIndex++
      ) {
        require(poolIds[firstIndex] != poolIds[secondIndex], "DTSP");

        require(
          incompatibilityProtocols[poolIds[firstIndex]][poolIds[secondIndex]] ==
            false &&
            incompatibilityProtocols[poolIds[secondIndex]][
              poolIds[firstIndex]
            ] ==
            false,
          "PC"
        );
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
    external
    view
    returns (ProtocolView memory)
  {
    require(poolId < nextPoolId, "A: out of range");

    address poolAddress = protocolsMapping[poolId].deployed;

    (
      string memory name,
      uint256 insuredCapital,
      uint256 availableCapacity,
      uint256 utilizationRate,
      uint256 premiumRate
    ) = IProtocolPool(poolAddress).protocolInfo();

    return
      ProtocolView(
        name,
        poolId,
        insuredCapital,
        availableCapacity,
        utilizationRate,
        premiumRate
      );
  }

  function getAllProtocols()
    external
    view
    returns (ProtocolView[] memory protocols)
  {
    for (uint128 i = 0; i < nextPoolId; i++) {
      (
        string memory name,
        uint256 insuredCapital,
        uint256 availableCapacity,
        uint256 utilizationRate,
        uint256 premiumRate
      ) = IProtocolPool(protocolsMapping[i].deployed).protocolInfo();

      protocols[i] = ProtocolView(
        name,
        i,
        insuredCapital,
        availableCapacity,
        utilizationRate,
        premiumRate
      );
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

    IPolicyManager(policyManager).processExpiredTokens(__expiredTokens);
  }

  function actualizingProtocolAndRemoveExpiredPoliciesByPoolId(uint128 poolId_)
    public
  {
    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[poolId_].deployed
    );
  }

  /// ================================== ///
  /// ========== ATEN STAKING ========== ///
  /// ================================== ///

  /** @notice
   * Stake ATEN in the general staking pool to earn interests.
   * @dev Also updates covers if the update causes a fee level change
   * @param amount_ the amount of ATEN to stake
   **/
  function stakeAtens(uint256 amount_) external override {
    IPositionsManager positionManagerInterface = IPositionsManager(
      positionsManager
    );

    // Check if user has positions that will require an update
    uint256[] memory tokenList = positionManagerInterface
      .allPositionTokensOfOwner(msg.sender);

    // If the user has positions check if unstaking affects fee level
    if (tokenList.length != 0) {
      // Get the user's first position
      // @dev We only check the first position because the fee level is the same for all positions
      IPositionsManager.Position memory userPosition = positionManagerInterface
        .position(tokenList[0]);

      // Check the position's fee level
      uint128 currentFeeLevel = userPosition.feeRate;

      // Check the user's balance of staked ATEN + staking rewards
      uint256 stakedAten = IStakedAten(stakedAtensGP).positionOf(msg.sender);

      // Compute the fee level after adding accrued interests and removing withdrawal
      uint256 balanceAfterWithdraw = stakedAten + amount_;
      uint128 newFeeLevel = getFeeRateWithAten(balanceAfterWithdraw);

      // If the fee level changes, update all positions
      if (currentFeeLevel != newFeeLevel) {
        for (uint256 i = 0; i < tokenList.length; i++) {
          positionManagerInterface.takeInterestsInAllPools(
            msg.sender,
            tokenList[i]
          );

          positionManagerInterface.updateFeeLevel(tokenList[i], newFeeLevel);
        }
      }
    }

    // Get the amount of capital supplied by the user
    uint256 usdCapitalSupplied = positionManagerInterface
      .allCapitalSuppliedByAccount(msg.sender);

    // Deposit ATEN in the staking pool
    IStakedAten(stakedAtensGP).stake(msg.sender, amount_, usdCapitalSupplied);
  }

  /** @notice
   * Remove ATEN from the general staking pool.
   * @dev Also updates covers if the update causes a fee level change
   * @param amount_ the amount of ATEN to withdraw
   **/
  function unstakeAtens(uint256 amount_) external {
    IPositionsManager positionManagerInterface = IPositionsManager(
      positionsManager
    );

    // Check if user has positions that will require an update
    uint256[] memory tokenList = positionManagerInterface
      .allPositionTokensOfOwner(msg.sender);

    // If the user has positions check if unstaking affects fee level
    if (tokenList.length != 0) {
      // Get the user's first position
      IPositionsManager.Position memory userPosition = positionManagerInterface
        .position(tokenList[0]);

      // Check the position's fee level
      uint128 currentFeeLevel = userPosition.feeRate;

      // Check the user's balance of staked ATEN + staking rewards
      uint256 stakedAten = IStakedAten(stakedAtensGP).positionOf(msg.sender);

      // Compute the fee level after adding accrued interests and removing withdrawal
      uint256 balanceAfterWithdraw = stakedAten - amount_;
      uint128 newFeeLevel = getFeeRateWithAten(balanceAfterWithdraw);

      // If the fee level changes, update all positions
      if (currentFeeLevel != newFeeLevel) {
        for (uint256 i = 0; i < tokenList.length; i++) {
          positionManagerInterface.takeInterestsInAllPools(
            msg.sender,
            tokenList[i]
          );

          positionManagerInterface.updateFeeLevel(tokenList[i], newFeeLevel);
        }
      }
    }

    // Withdraw from the staking pool
    IStakedAten(stakedAtensGP).withdraw(msg.sender, amount_);
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

    // check the user's balance of staked ATEN + staking rewards
    uint256 stakedAten = IStakedAten(stakedAtensGP).positionOf(msg.sender);

    // if user has staked ATEN then get feeRate
    uint128 stakingFeeRate;
    if (stakedAten > 0) {
      stakingFeeRate = getFeeRateWithAten(stakedAten);
    }

    // deposit assets in the pool and create position NFT
    IPositionsManager(positionsManager).deposit(
      msg.sender,
      amount,
      stakingFeeRate,
      poolIds
    );
  }

  function takeInterest(uint256 tokenId, uint128 poolId)
    public
    onlyPositionTokenOwner(tokenId)
  {
    IPositionsManager(positionsManager).takeInterest(
      msg.sender,
      tokenId,
      poolId
    );
  }

  function addLiquidityToPosition(uint256 tokenId, uint256 amount)
    external
    onlyPositionTokenOwner(tokenId)
  {
    // retrieve user funds for coverage
    IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), amount);

    // check the user's balance of staked ATEN + staking rewards
    uint256 stakedAten = IStakedAten(stakedAtensGP).positionOf(msg.sender);

    // if user has staked ATEN then get feeRate
    uint128 newStakingFeeRate;
    if (stakedAten > 0) {
      newStakingFeeRate = getFeeRateWithAten(stakedAten);
    }

    IPositionsManager(positionsManager).updatePosition(
      msg.sender,
      tokenId,
      amount,
      newStakingFeeRate
    );
  }

  function committingWithdrawAll(uint256 tokenId)
    external
    onlyPositionTokenOwner(tokenId)
  {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) > 0,
      "No position to commit withdraw"
    );

    IPositionsManager.Position memory __position = IPositionsManager(
      positionsManager
    ).position(tokenId);

    for (uint256 index = 0; index < __position.poolIds.length; index++)
      IProtocolPool(protocolsMapping[__position.poolIds[index]].deployed)
        .committingWithdrawLiquidity(tokenId);
  }

  function withdrawAll(uint256 tokenId)
    external
    onlyPositionTokenOwner(tokenId)
  {
    IPositionsManager __positionsManager = IPositionsManager(positionsManager);

    IPositionsManager.Position memory __position = __positionsManager.position(
      tokenId
    );

    uint256 __newUserCapital;
    uint256 __aaveScaledBalanceToRemove;
    for (uint256 index = 0; index < __position.poolIds.length; index++) {
      IProtocolPool __protocol = IProtocolPool(
        protocolsMapping[__position.poolIds[index]].deployed
      );

      require(
        __protocol.isWithdrawLiquidityDelayOk(tokenId),
        "Withdraw reserve"
      );

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

    __positionsManager.burn(tokenId);

    address __lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();

    uint256 _amountToWithdrawFromAAVE = __position.aaveScaledBalance.rayMul(
      ILendingPool(__lendingPool).getReserveNormalizedIncome(stablecoin)
    );

    ILendingPool(__lendingPool).withdraw(
      stablecoin,
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
    uint256[] calldata atensLockedArray_,
    uint128[] calldata poolIdArray_
  ) public payable nonReentrant {
    uint256 nbPolicies = poolIdArray_.length;

    for (uint256 i = 0; i < nbPolicies; i++) {
      uint256 _amountCovered = amountCoveredArray_[i];
      uint256 _premiumDeposit = premiumDepositArray_[i];
      uint256 _atensLocked = atensLockedArray_[i];
      uint128 _poolId = poolIdArray_[i];

      require(
        _amountCovered > 0 && _premiumDeposit > 0,
        "Must be greater than 0"
      );

      IERC20(stablecoin).safeTransferFrom(
        msg.sender,
        protocolsMapping[_poolId].deployed,
        _premiumDeposit
      );

      uint256 policyId = IPolicyManager(policyManager).mint(
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
        require(
          (__price * _atensLocked) / pricePrecision <=
            (_premiumDeposit * __decimalsRatio),
          "A: amount ATEN too high"
        );

        IStakedAtenPolicy(stakedAtensPo).stake(
          msg.sender,
          policyId,
          _atensLocked
        );
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
    IPolicyManager policyManagerInterface = IPolicyManager(policyManager);

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
    require(isStillActive, "A: policy is expired");

    // If ATEN was staked along with the policy then process the staking withdrawal
    if (0 < userPolicy.atensLocked) {
      if (userPolicy.beginCoveredTime + 365 days <= block.timestamp) {
        // If a year has elapsed then consume staking position and withdraw ATEN + rewards
        _processPolicyStakingPayout(msg.sender, policyId_);
      } else {
        // If a year has not elapsed then consume staking position and withdraw ATEN
        IStakedAtenPolicy(stakedAtensPo).earlyWithdraw(msg.sender, policyId_);
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
   * Manages the withdrawal of staked ATEN in policy pool and rewards payment.
   * @param account_ the address of the user
   * @param policyId_ the id of the policy position
   */
  function _processPolicyStakingPayout(address account_, uint256 policyId_)
    private
  {
    // Get the amount of rewards, consume the staking position and send back staked ATEN to user
    uint256 amountRewards = IStakedAtenPolicy(stakedAtensPo).withdraw(
      account_,
      policyId_
    );

    // Check the amount is above 0
    require(amountRewards > 0, "A: withdrawable amount is 0");

    // Send the rewards to the user from the vault
    IVaultERC20(atensVault).sendReward(account_, amountRewards);
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
    IStakedAtenPolicy(stakedAtensPo).earlyWithdraw(msg.sender, policyId_);
  }

  /**
   * @notice
   * Withdraws the staking rewards generated from a policy staking position.
   * @param policyId_ the id of the policy position
   */
  function withdrawAtensPolicy(uint256 policyId_)
    external
    onlyPolicyTokenOwner(policyId_)
  {
    IPolicyManager policyManagerInterface = IPolicyManager(policyManager);

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
    require(isStillActive, "A: policy is expired");

    // Process withdrawal and rewards payment
    _processPolicyStakingPayout(msg.sender, policyId_);
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
    IPolicyManager.Policy memory userPolicy = IPolicyManager(policyManager)
      .policy(policyId_);

    address poolAddress = protocolsMapping[userPolicy.poolId].deployed;

    IProtocolPool poolInterface = IProtocolPool(poolAddress);
    uint256 ratio = poolInterface.ratioWithAvailableCapital(amount_);

    ILendingPool lendingPoolInterface = ILendingPool(
      ILendingPoolAddressesProvider(aaveAddressesRegistry).getLendingPool()
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

  /**
   * @notice
   * Sets the APR applied to newly created policies that stake ATEN in the policy staking pool.
   * @param newRate_ the new reward rate (100% APR = 10_000)
   */
  function setPolicyStakingRewards(uint128 newRate_) external onlyOwner {
    IStakedAtenPolicy(stakedAtensPo).setRewardsPerYear(newRate_);
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
    for (uint256 index = 0; index < levels_.length; index++) {
      AtenFeeLevel calldata level = levels_[index];

      if (index == 0) {
        // Require that the first level indicates fees for atenAmount 0
        require(level.atenAmount == 0, "A: Must specify base rate");
      } else {
        // If it isn't the first item check that items are ascending
        require(
          levels_[index - 1].atenAmount < level.atenAmount,
          "A: Sort rates in ascending order"
        );
      }

      // Check that APR is not higher than 100%
      require(level.feeRate < 10_000, "A: fee >= 100%");

      // save to storage
      supplyFeeLevels.push(level);
    }
  }

  /// -------- PROTOCOL POOLS -------- ///

  function addNewProtocol(
    string calldata name,
    uint8 guaranteeType,
    uint8 premiumRate, //Thao@NOTE: not used
    address iface,
    uint128[] calldata protocolsNotCompat,
    string calldata ipfsAgreementHash_
  ) public onlyOwner {
    uint128 newPoolId = nextPoolId;
    nextPoolId++;

    address _protocolDeployed = IProtocolFactory(protocolFactory)
      .deployProtocol(
        name,
        stablecoin,
        newPoolId,
        75 * 1e27,
        1e27,
        5e27,
        11e26
      );

    // Add the meta evidence IPFS address to the registry
    IClaimManager(claimManager).addAgreementForProtocol(
      newPoolId,
      ipfsAgreementHash_
    );

    Protocol memory newProtocol = Protocol({
      id: newPoolId,
      name: name,
      protocolAddress: iface,
      premiumRate: premiumRate,
      guarantee: guaranteeType,
      deployed: _protocolDeployed,
      active: true,
      claimsOngoing: 0
    });

    for (uint256 i = 0; i < protocolsNotCompat.length; i++) {
      incompatibilityProtocols[newPoolId][protocolsNotCompat[i]] = true;
    }

    protocolsMapping[newPoolId] = newProtocol;

    emit NewProtocol(newPoolId);
  }

  // @bw unused
  function pauseProtocol(uint128 poolId, bool pause) external onlyOwner {
    protocolsMapping[poolId].active = pause;
  }

  /// -------- AAVE -------- ///

  function setAAVEAddressesRegistry(address _aaveAddressesRegistry)
    external
    onlyOwner
  {
    aaveAddressesRegistry = _aaveAddressesRegistry;
  }

  function approveLendingPool() internal {
    IERC20(stablecoin).safeApprove(
      ILendingPoolAddressesProvider(aaveAddressesRegistry).getLendingPool(),
      2**256 - 1
    );
  }

  //onlyPositionManager
  // @bw onlyPositionManager
  function transferLiquidityToAAVE(uint256 amount)
    external
    override
    returns (uint256)
  {
    address lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();

    ILendingPool(lendingPool).deposit(stablecoin, amount, address(this), 0);

    return
      amount.rayDiv(
        ILendingPool(lendingPool).getReserveNormalizedIncome(stablecoin)
      );
  }
}
