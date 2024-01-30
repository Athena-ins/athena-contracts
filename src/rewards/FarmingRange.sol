// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { IFarmingRange } from "../interfaces/IFarmingRange.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";

//======== ERRORS ========//

// Reward manager is not defined
error RewardManagerNotDefined();
// Start block should be in the future
error StartBlockInPast();
// Reward info length exceeds the limit
error RewardInfoLengthExceedsLimit();
// Reward period ended
error RewardPeriodEnded();
// Bad new endblock
error BadNewEndblock();
// Wrong parameters length
error WrongParametersLength();
// Reward period end is in next range
error RewardPeriodEndIsInNextRange();
// No rewardInfoLen
error NoRewardInfoLength();
// Sender not farming
error SenderNotFarming();
// Campaign id not valid
error InvalidCampaignId();
// Bad withdraw amount
error BadWithdrawAmount();
// Only for ERC-20 token campaigns
error OnlyERC20Campaigns();
// Only for ERC-20 token campaigns
error OnlyERC721Campaigns();
// Only for ERC-721 token campaigns
error OnlyLiquidityProviderCampaigns();
// Only for ERC-721 token campaigns
error OnlyCoverUserCampaigns();
// Unsupported campaign pool id
error IncompatiblePoolIds();
// NFT already deposited in campaign
error AlreadyDeposited();
// NFT is not deposited in campaign
error NotDepositor();
// Limits covers with odd ratios
error BadCoverAmountToPremiumRatio();
// Cover has not expired yet
error CoverStillActive();
// Only liquidity manager can call this function
error OnlyLiquidityManager();
// Only staking contract can call this function
error OnlyStaking();
// Cannot farm position commited to withdrawal
error CannotFarmPositionCommitedToWithdrawal();

/**
 * @title FarmingRange
 * @notice Farming Range allows users to stake LP Tokens to receive various rewards
 * @custom:from Contract taken from the smardex protocol, adapted to version 0.8.20 and modified to use ERC-721 instead or ERC-20 tokens
 * @custom:url https://github.com/SmarDex-Dev/smart-contracts/blob/main/contracts/rewards/FarmingRange.sol
 */
contract FarmingRange is IFarmingRange, Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  struct AccountTokens {
    uint256[] lpTokenIds;
    uint256[] coverTokenIds;
  }

  mapping(uint256 _campaignId => RewardInfo[])
    public campaignRewardInfo;

  CampaignInfo[] public campaignInfo;

  // For ERC-20 campaigns
  mapping(uint256 _campaignId => mapping(address _account => UserInfo))
    public userInfo;
  // For ERC-721 campaigns
  mapping(uint256 _campaignId => mapping(uint256 _tokenId => UserInfo))
    public userInfoNft;

  // Used to track the ERC-721 tokens deposited by a user
  mapping(address _account => AccountTokens _balances)
    private _balances;
  mapping(uint256 _lpTokenId => uint256 _nbCampaigns)
    public nbLpTokenCampaigns;
  mapping(uint256 _coverId => uint256 _campaignId)
    public coverIdToCampaignId;
  mapping(uint256 _campaignId => mapping(uint256 _tokenId => address _account))
    public campaignTokenDeposits;

  uint256 public rewardInfoLimit;
  address public immutable rewardManager;
  IStaking public staking;
  ILiquidityManager public liquidityManager;

  IAthenaPositionToken public positionToken;
  IAthenaCoverToken public coverToken;

  constructor(
    address _rewardManager,
    IStaking _staking,
    ILiquidityManager _liquidityManager,
    IAthenaPositionToken _positionToken,
    IAthenaCoverToken _coverToken
  ) Ownable(msg.sender) {
    rewardInfoLimit = 52;
    if (_rewardManager == address(0)) {
      revert RewardManagerNotDefined();
    }

    staking = _staking;
    liquidityManager = _liquidityManager;
    rewardManager = _rewardManager;
    positionToken = _positionToken;
    coverToken = _coverToken;
  }

  // ======= MODIFIERS ======= //

  modifier onlyLiquidityManager() {
    if (msg.sender != address(liquidityManager))
      revert OnlyLiquidityManager();
    _;
  }

  modifier onlyStaking() {
    if (msg.sender != address(staking)) revert OnlyStaking();
    _;
  }

  // ======= ACCOUNT ERC-721 BALANCE ======= //

  function depositedLpTokens(
    address _account
  ) public view returns (uint256[] memory) {
    return _balances[_account].lpTokenIds;
  }

  function depositedCoverTokens(
    address _account
  ) external view returns (uint256[] memory) {
    return _balances[_account].coverTokenIds;
  }

  function _addToken(
    address _account,
    uint256 _lpTokenId,
    AssetType _assetType
  ) internal {
    // @dev Requires to have checked that campaign is not for ERC-20 tokens
    uint256[] storage tokenIds = _assetType == AssetType.LP_ERC721
      ? _balances[_account].lpTokenIds
      : _balances[_account].coverTokenIds;

    tokenIds.push(_lpTokenId);
  }

  function _removeToken(
    address _account,
    uint256 _lpTokenId,
    AssetType _assetType
  ) internal {
    // @dev Requires to have checked that campaign is not for ERC-20 tokens
    uint256[] storage tokenIds = _assetType == AssetType.LP_ERC721
      ? _balances[_account].lpTokenIds
      : _balances[_account].coverTokenIds;

    uint256 nbLpTokens = tokenIds.length;
    for (uint256 i; i < nbLpTokens; i++) {
      if (tokenIds[i] == _lpTokenId) {
        // If the token is not the last in the array, replace it with the last one
        if (i != nbLpTokens - 1) {
          tokenIds[i] = tokenIds[nbLpTokens - 1];
        }

        // Delete last element from the array
        tokenIds.pop();
        break;
      }
    }
  }

  function _removeCoverToken(
    address _account,
    uint256 _coverTokenId
  ) internal {
    uint256[] storage coverTokenIds = _balances[_account]
      .coverTokenIds;
    uint256 nbCoverTokens = coverTokenIds.length;
    for (uint256 i; i < nbCoverTokens; i++) {
      if (coverTokenIds[i] == _coverTokenId) {
        coverTokenIds[i] = coverTokenIds[nbCoverTokens - 1];
        coverTokenIds.pop();
        break;
      }
    }
  }

  // ======= TAKE PROFIT WITH FEE BONUS ======= //

  function yieldBonusChanged(
    address account_,
    uint256 yieldBonus_
  ) external onlyStaking {
    // Check if user has farming LP tokens
    uint256[] memory positionIds = depositedLpTokens(account_);

    if (0 != positionIds.length) {
      // Cause a take profit of farming LP tokens at previous yield bonus rate
      liquidityManager.takeInterestsWithYieldBonus(
        account_,
        yieldBonus_,
        positionIds
      );
    }
  }

  function _takeProfitOnWithdrawal(uint256 tokenId_) internal {
    uint256 yieldBonus = staking.yieldBonusOf(msg.sender);

    // If user has a yield bonus then take interest with yield bonus
    if (yieldBonus != 0) {
      uint256[] memory positionIds = new uint256[](1);
      positionIds[0] = tokenId_;

      liquidityManager.takeInterestsWithYieldBonus(
        msg.sender,
        yieldBonus,
        positionIds
      );
    }
  }

  // ======= DEPOSITS ======= //

  function _deposit(
    uint256 _campaignID,
    uint256 _amount,
    bool _isNft,
    uint256 _tokenId
  ) internal {
    CampaignInfo storage campaign = campaignInfo[_campaignID];
    UserInfo storage user = _isNft
      ? userInfoNft[_campaignID][_tokenId]
      : userInfo[_campaignID][msg.sender];

    _updateCampaign(_campaignID);
    if (user.amount != 0) {
      uint256 _pending = (user.amount * campaign.accRewardPerShare) /
        1e20 -
        user.rewardDebt;
      if (_pending != 0) {
        campaign.rewardToken.safeTransfer(
          address(msg.sender),
          _pending
        );
      }
    }
    if (_amount != 0) {
      user.amount = user.amount + _amount;
      campaign.totalStaked = campaign.totalStaked + _amount;
    }
    user.rewardDebt =
      (user.amount * campaign.accRewardPerShare) /
      (1e20);
    emit Deposit(msg.sender, _amount, _campaignID);
  }

  /// @inheritdoc IFarmingRange
  function deposit(
    uint256 _campaignID,
    uint256 _amount
  ) public nonReentrant {
    if (campaignInfo[_campaignID].assetType != AssetType.ERC20)
      revert OnlyERC20Campaigns();

    if (_amount != 0) {
      campaignInfo[_campaignID].stakingToken.safeTransferFrom(
        msg.sender,
        address(this),
        _amount
      );
    }

    _deposit(_campaignID, _amount, false, 0);
  }

  function depositLpNft(
    uint256[] calldata _campaignIDs,
    uint256 _tokenId
  ) public nonReentrant {
    positionToken.transferFrom(msg.sender, address(this), _tokenId);

    ILiquidityManager.Position memory lpPosition = liquidityManager
      .positions(_tokenId);

    // Check that the position is not committed to be withdrawn
    if (lpPosition.commitWithdrawalTimestamp != 0)
      revert CannotFarmPositionCommitedToWithdrawal();

    uint256 amount = lpPosition.supplied;
    uint64[] memory poolIds = lpPosition.poolIds;

    uint256 nbPositionPools = poolIds.length;
    uint256 nbCampaigns = _campaignIDs.length;

    for (uint256 i; i < nbCampaigns; i++) {
      uint256 campaignID = _campaignIDs[i];
      uint256 campaignPoolId = campaignInfo[campaignID].poolId;

      if (campaignInfo[campaignID].assetType != AssetType.LP_ERC721)
        revert OnlyLiquidityProviderCampaigns();

      bool hasRequiredPools;
      for (uint256 j; j < nbPositionPools; j++) {
        if (campaignPoolId == poolIds[j]) {
          hasRequiredPools = true;
          break;
        }
      }
      if (!hasRequiredPools) revert IncompatiblePoolIds();

      // Avoid user depositing multiple times in same campaign
      if (campaignTokenDeposits[campaignID][_tokenId] != address(0))
        revert AlreadyDeposited();
      campaignTokenDeposits[campaignID][_tokenId] = msg.sender;

      _deposit(campaignID, amount, true, _tokenId);
    }

    nbLpTokenCampaigns[_tokenId] += nbCampaigns;
    // Add lp token to user balance
    _addToken(msg.sender, _tokenId, AssetType.LP_ERC721);
  }

  function depositCoverNft(
    uint256 _campaignID,
    uint256 _tokenId
  ) public nonReentrant {
    if (campaignInfo[_campaignID].assetType != AssetType.COVER_ERC721)
      revert OnlyCoverUserCampaigns();

    coverToken.transferFrom(msg.sender, address(this), _tokenId);

    ILiquidityManager.CoverRead memory cover = liquidityManager
      .covers(_tokenId);

    // For cover campaigns there is only one poolId
    if (campaignInfo[_campaignID].poolId != cover.poolId)
      revert IncompatiblePoolIds();

    // Ratio penalty limits manipulative cover amount to premium ratios
    // The first stage applies a penalty, the second stage rejects the deposit
    //
    // Stage 1:
    // Minimum $0.5 of cover per $1 of premium (200% premiums)
    // Maximum $400 of cover per $1 of premium (0.25% premiums)
    // Outside of these ranges the computed amount is divided by 4
    //
    // Stage 2:
    // Minimum $0.2 of cover per $1 of premium (500% premiums)
    // Maximum $1000 of cover per $1 of premium (0.1% premiums)
    // Outside of these ranges farming is rejected
    //
    uint256 coverAmount = cover.coverAmount;
    uint256 premiums = cover.premiumsLeft;

    uint256 ratioPenalty = 1;
    if (coverAmount * 2 < premiums || premiums * 500 < coverAmount) {
      ratioPenalty = 4;

      if (coverAmount * 5 < premiums || premiums * 1000 < coverAmount)
        revert BadCoverAmountToPremiumRatio();
    }

    campaignTokenDeposits[_campaignID][_tokenId] = msg.sender;
    coverIdToCampaignId[_tokenId] = _campaignID;

    uint256 amount = (coverAmount * premiums) / ratioPenalty;
    _deposit(_campaignID, amount, true, _tokenId);

    // Add cover token to user balance
    _addToken(msg.sender, _tokenId, AssetType.COVER_ERC721);
  }

  /// @inheritdoc IFarmingRange
  function depositWithPermit(
    uint256 _campaignID,
    uint256 _amount,
    bool _approveMax,
    uint256 _deadline,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) external {
    IERC20Permit(address(campaignInfo[_campaignID].stakingToken))
      .permit(
        msg.sender,
        address(this),
        _approveMax ? type(uint256).max : _amount,
        _deadline,
        _v,
        _r,
        _s
      );

    deposit(_campaignID, _amount);
  }

  // ======= WITHDRAW ======= //

  /**
   * @notice Withdraw staking token in a campaign. Also withdraw the current pending reward
   * @param _campaignID campaign id
   * @param _amount amount to withdraw
   */
  function _withdraw(
    uint256 _campaignID,
    uint256 _amount,
    bool _isNft,
    uint256 _tokenId
  ) internal {
    CampaignInfo storage campaign = campaignInfo[_campaignID];
    address owner = _isNft
      ? campaignTokenDeposits[_campaignID][_tokenId]
      : msg.sender;
    UserInfo storage user = _isNft
      ? userInfoNft[_campaignID][_tokenId]
      : userInfo[_campaignID][owner];

    if (user.amount < _amount) {
      revert BadWithdrawAmount();
    }

    // If the cover expired before withdrawal then use the accRewardPerShare at expiry
    uint256 accRewardPerShare = _isNft &&
      user.accRewardPerShareOnExpiry != 0
      ? user.accRewardPerShareOnExpiry
      : campaign.accRewardPerShare;

    _updateCampaign(_campaignID);
    uint256 _pending = (user.amount * accRewardPerShare) /
      1e20 -
      user.rewardDebt;
    if (_pending != 0) {
      campaign.rewardToken.safeTransfer(owner, _pending);
    }
    if (_amount != 0) {
      user.amount = user.amount - _amount;
      campaign.totalStaked = campaign.totalStaked - _amount;
    }
    user.rewardDebt = (user.amount * accRewardPerShare) / 1e20;

    emit Withdraw(owner, _amount, _campaignID);
  }

  /// @inheritdoc IFarmingRange
  function withdraw(
    uint256 _campaignID,
    uint256 _amount
  ) external nonReentrant {
    if (campaignInfo[_campaignID].assetType != AssetType.ERC20)
      revert OnlyERC20Campaigns();

    _withdraw(_campaignID, _amount, false, 0);

    campaignInfo[_campaignID].stakingToken.safeTransfer(
      msg.sender,
      _amount
    );
  }

  function withdrawLpNft(
    uint256[] calldata _campaignIDs,
    uint256 _tokenId
  ) external nonReentrant {
    uint256 nbCampaigns = _campaignIDs.length;

    for (uint256 i; i < nbCampaigns; i++) {
      uint256 campaignID = _campaignIDs[i];
      if (campaignInfo[campaignID].assetType != AssetType.LP_ERC721)
        revert OnlyLiquidityProviderCampaigns();

      if (campaignTokenDeposits[campaignID][_tokenId] != msg.sender)
        revert NotDepositor();
      campaignTokenDeposits[campaignID][_tokenId] = address(0);

      nbLpTokenCampaigns[_tokenId]--;

      uint256 amount = userInfoNft[campaignID][_tokenId].amount;
      _withdraw(campaignID, amount, true, _tokenId);
    }

    if (nbLpTokenCampaigns[_tokenId] == 0) {
      // Check if user benefits from a yield bonus
      _takeProfitOnWithdrawal(_tokenId);

      positionToken.transferFrom(address(this), msg.sender, _tokenId);
      // Remove lp token from user balance
      _removeToken(msg.sender, _tokenId, AssetType.LP_ERC721);
    }
  }

  function withdrawCoverNft(
    uint256 _campaignID,
    uint256 _tokenId
  ) external nonReentrant {
    if (campaignInfo[_campaignID].assetType != AssetType.COVER_ERC721)
      revert OnlyCoverUserCampaigns();

    if (campaignTokenDeposits[_campaignID][_tokenId] != msg.sender)
      revert NotDepositor();
    campaignTokenDeposits[_campaignID][_tokenId] = address(0);
    delete coverIdToCampaignId[_tokenId];

    uint256 amount = userInfoNft[_campaignID][_tokenId].amount;
    _withdraw(_campaignID, amount, true, _tokenId);

    coverToken.transferFrom(address(this), msg.sender, _tokenId);
    // Remove cover token from user balance
    _removeToken(msg.sender, _tokenId, AssetType.COVER_ERC721);
  }

  /// @inheritdoc IFarmingRange
  function harvest(
    uint256[] calldata _campaignIDs,
    uint256[][] calldata _tokenIds
  ) external nonReentrant {
    uint256 nbCampaigns = _campaignIDs.length;
    for (uint256 i; i != nbCampaigns; i++) {
      uint256 campaignID = _campaignIDs[i];

      if (campaignInfo[campaignID].assetType == AssetType.ERC20) {
        _withdraw(campaignID, 0, false, 0);
      } else {
        uint256 nbTokens = _tokenIds[i].length;
        for (uint256 j; j != nbTokens; j++) {
          uint256 tokenId = _tokenIds[i][j];

          if (
            campaignTokenDeposits[campaignID][tokenId] != msg.sender
          ) revert NotDepositor();

          _withdraw(campaignID, 0, true, tokenId);
        }
      }
    }
  }

  /// @inheritdoc IFarmingRange
  function emergencyWithdraw(
    uint256 _campaignID
  ) external nonReentrant {
    CampaignInfo storage campaign = campaignInfo[_campaignID];

    if (campaign.assetType != AssetType.ERC20)
      revert OnlyERC20Campaigns();

    UserInfo storage user = userInfo[_campaignID][msg.sender];
    uint256 _amount = user.amount;
    campaign.totalStaked = campaign.totalStaked - _amount;
    user.amount = 0;
    user.rewardDebt = 0;

    // Only transfer staked tokens for ERC-20 campaigns
    campaign.stakingToken.safeTransfer(msg.sender, _amount);

    emit EmergencyWithdraw(msg.sender, _amount, _campaignID);
  }

  function emergencyWithdrawNft(
    uint256[] calldata _campaignIDs,
    uint256[][] calldata _tokenIds
  ) external nonReentrant {
    for (uint256 i; i != _campaignIDs.length; i++) {
      uint256 campaignID = _campaignIDs[i];
      CampaignInfo storage campaign = campaignInfo[campaignID];
      AssetType assetType = campaign.assetType;

      if (assetType == AssetType.ERC20) revert OnlyERC721Campaigns();

      for (uint256 j; j != _tokenIds[i].length; j++) {
        uint256 tokenId = _tokenIds[i][j];

        if (campaignTokenDeposits[campaignID][tokenId] != msg.sender)
          revert NotDepositor();
        campaignTokenDeposits[campaignID][tokenId] = address(0);

        UserInfo storage user = userInfoNft[campaignID][tokenId];
        uint256 _amount = user.amount;
        campaign.totalStaked = campaign.totalStaked - _amount;
        user.amount = 0;
        user.rewardDebt = 0;

        if (assetType == AssetType.COVER_ERC721) {
          coverToken.transferFrom(address(this), msg.sender, tokenId);

          delete coverIdToCampaignId[tokenId];
          // Remove cover token from user balance
          _removeToken(msg.sender, tokenId, assetType);
        } else if (assetType == AssetType.LP_ERC721) {
          nbLpTokenCampaigns[tokenId]--;

          if (nbLpTokenCampaigns[tokenId] == 0) {
            positionToken.transferFrom(
              address(this),
              msg.sender,
              tokenId
            );

            // Remove lp token from user balance
            _removeToken(msg.sender, tokenId, assetType);
          }
        }

        emit EmergencyWithdraw(msg.sender, _amount, campaignID);
      }
    }
  }

  // ======= EXPIRED COVER ======= //

  function freezeExpiredCoverRewards(
    uint256 _tokenId
  ) external onlyLiquidityManager {
    uint256 campaignID = coverIdToCampaignId[_tokenId];
    _updateCampaign(campaignID);

    CampaignInfo storage campaign = campaignInfo[campaignID];
    userInfoNft[campaignID][_tokenId]
      .accRewardPerShareOnExpiry = campaign.accRewardPerShare;
  }

  function forceExpiredCoverWithdrawal(
    uint256 _tokenId
  ) public nonReentrant {
    // Avoids terminated covers to unfairly farm rewards
    uint256 campaignID = coverIdToCampaignId[_tokenId];
    if (campaignInfo[campaignID].assetType != AssetType.COVER_ERC721)
      revert OnlyCoverUserCampaigns();

    if (liquidityManager.isCoverActive(_tokenId))
      revert CoverStillActive();

    uint256 amount = userInfoNft[campaignID][_tokenId].amount;
    _withdraw(campaignID, amount, true, _tokenId);

    address owner = campaignTokenDeposits[campaignID][_tokenId];
    coverToken.transferFrom(address(this), owner, _tokenId);
    // Remove cover token from user balance
    _removeToken(owner, _tokenId, AssetType.COVER_ERC721);

    campaignTokenDeposits[campaignID][_tokenId] = address(0);
    delete coverIdToCampaignId[_tokenId];
  }

  function forceExpiredCoverWithdrawalMultiple(
    uint256[] calldata _tokenIds
  ) external nonReentrant {
    uint256 nbTokens = _tokenIds.length;
    for (uint256 i; i < nbTokens; i++) {
      uint256 tokenId = _tokenIds[i];
      forceExpiredCoverWithdrawal(tokenId);
    }
  }

  // ======= CAMPAIGNS ======= //

  /// @inheritdoc IFarmingRange
  function setRewardInfoLimit(
    uint256 _updatedRewardInfoLimit
  ) external onlyOwner {
    rewardInfoLimit = _updatedRewardInfoLimit;
    emit SetRewardInfoLimit(rewardInfoLimit);
  }

  /// @inheritdoc IFarmingRange
  function addCampaignInfo(
    AssetType _assetType,
    uint256 _poolId,
    IERC20 _stakingToken,
    IERC20 _rewardToken,
    uint256 _startBlock
  ) external virtual onlyOwner {
    if (_startBlock < block.number) {
      revert StartBlockInPast();
    }

    campaignInfo.push(
      CampaignInfo({
        assetType: _assetType,
        poolId: _poolId,
        stakingToken: _stakingToken,
        rewardToken: _rewardToken,
        startBlock: _startBlock,
        lastRewardBlock: _startBlock,
        accRewardPerShare: 0,
        totalStaked: 0,
        totalRewards: 0
      })
    );

    emit AddCampaignInfo(
      campaignInfo.length - 1,
      _assetType,
      _poolId,
      address(_stakingToken),
      _rewardToken,
      _startBlock
    );
  }

  /// @inheritdoc IFarmingRange
  function addRewardInfo(
    uint256 _campaignID,
    uint256 _endBlock,
    uint256 _rewardPerBlock
  ) public virtual onlyOwner nonReentrant {
    RewardInfo[] storage rewardInfo = campaignRewardInfo[_campaignID];
    CampaignInfo storage campaign = campaignInfo[_campaignID];

    if (rewardInfo.length >= rewardInfoLimit) {
      revert RewardInfoLengthExceedsLimit();
    }
    if (rewardInfo.length != 0) {
      if (rewardInfo[rewardInfo.length - 1].endBlock < block.number) {
        revert RewardPeriodEnded();
      }
      if (rewardInfo[rewardInfo.length - 1].endBlock >= _endBlock) {
        revert BadNewEndblock();
      }
    }

    uint256 _startBlock = rewardInfo.length == 0
      ? campaign.startBlock
      : rewardInfo[rewardInfo.length - 1].endBlock;
    uint256 _blockRange = _endBlock - _startBlock;
    uint256 _totalRewards = _rewardPerBlock * _blockRange;
    campaign.totalRewards = campaign.totalRewards + _totalRewards;
    rewardInfo.push(
      RewardInfo({
        endBlock: _endBlock,
        rewardPerBlock: _rewardPerBlock
      })
    );
    _transferFromWithAllowance(
      campaign.rewardToken,
      _totalRewards,
      _campaignID
    );
    emit AddRewardInfo(
      _campaignID,
      rewardInfo.length - 1,
      _endBlock,
      _rewardPerBlock
    );
  }

  /// @inheritdoc IFarmingRange
  function addRewardInfoMultiple(
    uint256 _campaignID,
    uint256[] calldata _endBlock,
    uint256[] calldata _rewardPerBlock
  ) external onlyOwner {
    if (_endBlock.length != _rewardPerBlock.length) {
      revert WrongParametersLength();
    }

    for (uint256 _i; _i != _endBlock.length; ) {
      addRewardInfo(_campaignID, _endBlock[_i], _rewardPerBlock[_i]);
      unchecked {
        ++_i;
      }
    }
  }

  /// @inheritdoc IFarmingRange
  function updateRewardInfo(
    uint256 _campaignID,
    uint256 _rewardIndex,
    uint256 _endBlock,
    uint256 _rewardPerBlock
  ) public virtual onlyOwner nonReentrant {
    RewardInfo[] storage rewardInfo = campaignRewardInfo[_campaignID];
    CampaignInfo storage campaign = campaignInfo[_campaignID];
    RewardInfo storage selectedRewardInfo = rewardInfo[_rewardIndex];
    uint256 _previousEndBlock = selectedRewardInfo.endBlock;
    _updateCampaign(_campaignID);

    if (_previousEndBlock < block.number) {
      revert RewardPeriodEnded();
    }

    if (_rewardIndex != 0) {
      if (rewardInfo[_rewardIndex - 1].endBlock >= _endBlock) {
        revert BadNewEndblock();
      }
    }
    if (rewardInfo.length > _rewardIndex + 1) {
      if (_endBlock >= rewardInfo[_rewardIndex + 1].endBlock) {
        revert RewardPeriodEndIsInNextRange();
      }
    }

    (bool _refund, uint256 _diff) = _updateRewardsDiff(
      _rewardIndex,
      _endBlock,
      _rewardPerBlock,
      rewardInfo,
      campaign,
      selectedRewardInfo
    );
    if (!_refund && _diff != 0) {
      _transferFromWithAllowance(
        campaign.rewardToken,
        _diff,
        _campaignID
      );
    }
    // If _endblock is changed, and if we have another range after the updated one,
    // we need to update rewardPerBlock to distribute on the next new range or we could run out of tokens
    if (
      _endBlock != _previousEndBlock &&
      rewardInfo.length - 1 > _rewardIndex
    ) {
      RewardInfo storage nextRewardInfo = rewardInfo[
        _rewardIndex + 1
      ];
      uint256 _nextRewardInfoEndBlock = nextRewardInfo.endBlock;
      uint256 _initialBlockRange = _nextRewardInfoEndBlock -
        _previousEndBlock;
      uint256 _nextBlockRange = _nextRewardInfoEndBlock - _endBlock;
      uint256 _currentRewardPerBlock = nextRewardInfo.rewardPerBlock;
      uint256 _initialNextTotal = _initialBlockRange *
        _currentRewardPerBlock;
      _currentRewardPerBlock =
        (_currentRewardPerBlock * _initialBlockRange) /
        _nextBlockRange;
      uint256 _nextTotal = _nextBlockRange * _currentRewardPerBlock;
      nextRewardInfo.rewardPerBlock = _currentRewardPerBlock;
      if (_nextTotal < _initialNextTotal) {
        campaign.rewardToken.safeTransfer(
          rewardManager,
          _initialNextTotal - _nextTotal
        );
        campaign.totalRewards -= _initialNextTotal - _nextTotal;
      }
    }
    // UPDATE total
    campaign.totalRewards = _refund
      ? campaign.totalRewards - _diff
      : campaign.totalRewards + _diff;
    selectedRewardInfo.endBlock = _endBlock;
    selectedRewardInfo.rewardPerBlock = _rewardPerBlock;
    emit UpdateRewardInfo(
      _campaignID,
      _rewardIndex,
      _endBlock,
      _rewardPerBlock
    );
  }

  /// @inheritdoc IFarmingRange
  function updateRewardMultiple(
    uint256 _campaignID,
    uint256[] memory _rewardIndex,
    uint256[] memory _endBlock,
    uint256[] memory _rewardPerBlock
  ) public onlyOwner {
    if (
      _rewardIndex.length != _endBlock.length ||
      _rewardIndex.length != _rewardPerBlock.length
    ) {
      revert WrongParametersLength();
    }

    for (uint256 _i; _i != _rewardIndex.length; ) {
      updateRewardInfo(
        _campaignID,
        _rewardIndex[_i],
        _endBlock[_i],
        _rewardPerBlock[_i]
      );
      unchecked {
        ++_i;
      }
    }
  }

  /// @inheritdoc IFarmingRange
  function updateCampaignsRewards(
    uint256[] calldata _campaignID,
    uint256[][] calldata _rewardIndex,
    uint256[][] calldata _endBlock,
    uint256[][] calldata _rewardPerBlock
  ) external onlyOwner {
    if (
      _campaignID.length != _rewardIndex.length ||
      _campaignID.length != _endBlock.length ||
      _campaignID.length != _rewardPerBlock.length
    ) {
      revert WrongParametersLength();
    }

    for (uint256 _i; _i != _campaignID.length; ) {
      updateRewardMultiple(
        _campaignID[_i],
        _rewardIndex[_i],
        _endBlock[_i],
        _rewardPerBlock[_i]
      );
      unchecked {
        ++_i;
      }
    }
  }

  /// @inheritdoc IFarmingRange
  function removeLastRewardInfo(
    uint256 _campaignID
  ) external virtual onlyOwner {
    RewardInfo[] storage rewardInfo = campaignRewardInfo[_campaignID];
    CampaignInfo storage campaign = campaignInfo[_campaignID];
    uint256 _rewardInfoLength = rewardInfo.length;

    if (_rewardInfoLength == 0) {
      revert NoRewardInfoLength();
    }

    RewardInfo storage lastRewardInfo = rewardInfo[
      _rewardInfoLength - 1
    ];
    uint256 _lastRewardInfoEndBlock = lastRewardInfo.endBlock;

    if (_lastRewardInfoEndBlock <= block.number) {
      revert RewardPeriodEnded();
    }

    _updateCampaign(_campaignID);
    if (lastRewardInfo.rewardPerBlock != 0) {
      (bool _refund, uint256 _diff) = _updateRewardsDiff(
        _rewardInfoLength - 1,
        _lastRewardInfoEndBlock,
        0,
        rewardInfo,
        campaign,
        lastRewardInfo
      );
      if (_refund) {
        campaign.totalRewards = campaign.totalRewards - _diff;
      }
    }
    rewardInfo.pop();
    emit RemoveRewardInfo(_campaignID, _rewardInfoLength - 1);
  }

  /// @inheritdoc IFarmingRange
  function rewardInfoLen(
    uint256 _campaignID
  ) external view returns (uint256) {
    return campaignRewardInfo[_campaignID].length;
  }

  /// @inheritdoc IFarmingRange
  function campaignInfoLen() external view returns (uint256) {
    return campaignInfo.length;
  }

  /// @inheritdoc IFarmingRange
  function currentEndBlock(
    uint256 _campaignID
  ) external view virtual returns (uint256) {
    return _endBlockOf(_campaignID, block.number);
  }

  /// @inheritdoc IFarmingRange
  function currentRewardPerBlock(
    uint256 _campaignID
  ) external view virtual returns (uint256) {
    return _rewardPerBlockOf(_campaignID, block.number);
  }

  /// @inheritdoc IFarmingRange
  function getMultiplier(
    uint256 _from,
    uint256 _to,
    uint256 _endBlock
  ) public pure returns (uint256) {
    if ((_from >= _endBlock) || (_from > _to)) {
      return 0;
    }
    if (_to <= _endBlock) {
      return _to - _from;
    }
    return _endBlock - _from;
  }

  /// @inheritdoc IFarmingRange
  function pendingReward(
    uint256 _campaignID,
    address _user
  ) external view returns (uint256) {
    return
      _pendingReward(
        _campaignID,
        userInfo[_campaignID][_user].amount,
        userInfo[_campaignID][_user].rewardDebt
      );
  }

  /// @inheritdoc IFarmingRange
  function updateCampaign(uint256 _campaignID) external nonReentrant {
    _updateCampaign(_campaignID);
  }

  /// @inheritdoc IFarmingRange
  function massUpdateCampaigns() external nonReentrant {
    uint256 _length = campaignInfo.length;
    for (uint256 _i; _i != _length; ) {
      _updateCampaign(_i);
      unchecked {
        ++_i;
      }
    }
  }

  /**
   * @notice function to trick the compilator to use safeTransferFrom in try catch
   * @param _token token to interact with
   * @param _from address who own token
   * @param _to address to transfer token
   * @param _amount quantity to be transferred
   */
  function attemptTransfer(
    IERC20 _token,
    address _from,
    address _to,
    uint256 _amount
  ) external {
    if (msg.sender != address(this)) {
      revert SenderNotFarming();
    } // this function should be called only by this contract
    _token.safeTransferFrom(_from, _to, _amount);
  }

  /**
   * @notice return the endblock of the phase that contains _blockNumber
   * @param _campaignID the campaign id of the phases to check
   * @param _blockNumber the block number to check
   * @return the endblock of the phase that contains _blockNumber
   */
  function _endBlockOf(
    uint256 _campaignID,
    uint256 _blockNumber
  ) internal view returns (uint256) {
    RewardInfo[] memory rewardInfo = campaignRewardInfo[_campaignID];
    uint256 _len = rewardInfo.length;
    if (_len == 0) {
      return 0;
    }
    for (uint256 _i; _i != _len; ) {
      if (_blockNumber <= rewardInfo[_i].endBlock) {
        return rewardInfo[_i].endBlock;
      }
      unchecked {
        ++_i;
      }
    }
    /// @dev when couldn't find any reward info, it means that _blockNumber exceed endblock
    /// so return the latest reward info.
    return rewardInfo[_len - 1].endBlock;
  }

  /**
   * @notice return the rewardPerBlock of the phase that contains _blockNumber
   * @param _campaignID the campaign id of the phases to check
   * @param _blockNumber the block number to check
   * @return the rewardPerBlock of the phase that contains _blockNumber
   */
  function _rewardPerBlockOf(
    uint256 _campaignID,
    uint256 _blockNumber
  ) internal view returns (uint256) {
    RewardInfo[] memory rewardInfo = campaignRewardInfo[_campaignID];
    uint256 _len = rewardInfo.length;
    if (_len == 0) {
      return 0;
    }
    for (uint256 _i; _i != _len; ) {
      if (_blockNumber <= rewardInfo[_i].endBlock) {
        return rewardInfo[_i].rewardPerBlock;
      }
      unchecked {
        ++_i;
      }
    }
    /// @dev when couldn't find any reward info, it means that timestamp exceed endblock
    /// so return 0
    return 0;
  }

  /**
   * @notice in case of reward update, return reward diff and refund user if needed
   * @param _rewardIndex the number of the phase to update
   * @param _endBlock new endblock of the phase
   * @param _rewardPerBlock new rewardPerBlock of the phase
   * @param rewardInfo pointer on the array of rewardInfo in storage
   * @param campaign pointer on the campaign in storage
   * @param selectedRewardInfo pointer on the selectedRewardInfo in storage
   * @return refund_ boolean, true if user got refund
   * @return diff_ the reward difference
   */
  function _updateRewardsDiff(
    uint256 _rewardIndex,
    uint256 _endBlock,
    uint256 _rewardPerBlock,
    RewardInfo[] storage rewardInfo,
    CampaignInfo storage campaign,
    RewardInfo storage selectedRewardInfo
  ) internal virtual returns (bool refund_, uint256 diff_) {
    uint256 _previousStartBlock = _rewardIndex == 0
      ? campaign.startBlock
      : rewardInfo[_rewardIndex - 1].endBlock;
    uint256 _newStartBlock = block.number > _previousStartBlock
      ? block.number
      : _previousStartBlock;
    uint256 _previousBlockRange = selectedRewardInfo.endBlock -
      _previousStartBlock;
    uint256 _newBlockRange = _endBlock - _newStartBlock;
    uint256 _selectedRewardPerBlock = selectedRewardInfo
      .rewardPerBlock;
    uint256 _accumulatedRewards = (_newStartBlock -
      _previousStartBlock) * _selectedRewardPerBlock;
    uint256 _previousTotalRewards = _selectedRewardPerBlock *
      _previousBlockRange;
    uint256 _totalRewards = _rewardPerBlock * _newBlockRange;
    refund_ =
      _previousTotalRewards > _totalRewards + _accumulatedRewards;
    diff_ = refund_
      ? _previousTotalRewards - _totalRewards - _accumulatedRewards
      : _totalRewards + _accumulatedRewards - _previousTotalRewards;
    if (refund_) {
      campaign.rewardToken.safeTransfer(rewardManager, diff_);
    }
  }

  /**
   * @notice transfer tokens from rewardManger to this contract.
   * @param _rewardToken to reward token to be transferred from the rewardManager to this contract
   * @param _amount qty to be transferred
   * @param _campaignID id of the campaign so the rewardManager can fetch the rewardToken address to transfer
   *
   * @dev in case of fail, not enough allowance is considered to be the reason, so we call resetAllowance(uint256) on
   * the reward manager (which will reset allowance to uint256.max) and we try again to transfer
   */
  function _transferFromWithAllowance(
    IERC20 _rewardToken,
    uint256 _amount,
    uint256 _campaignID
  ) internal {
    try
      this.attemptTransfer(
        _rewardToken,
        rewardManager,
        address(this),
        _amount
      )
    {} catch {
      rewardManager.call(
        abi.encodeWithSignature(
          "resetAllowance(uint256)",
          _campaignID
        )
      );
      _rewardToken.safeTransferFrom(
        rewardManager,
        address(this),
        _amount
      );
    }
  }

  /**
   * @notice View function to retrieve pending Reward.
   * @param _campaignID pending reward of campaign id
   * @param _amount qty of staked token
   * @param _rewardDebt user info rewardDebt
   * @return pending rewards
   */
  function _pendingReward(
    uint256 _campaignID,
    uint256 _amount,
    uint256 _rewardDebt
  ) internal view virtual returns (uint256) {
    CampaignInfo memory _campaign = campaignInfo[_campaignID];
    RewardInfo[] memory _rewardInfo = campaignRewardInfo[_campaignID];
    uint256 _accRewardPerShare = _campaign.accRewardPerShare;

    if (
      block.number > _campaign.lastRewardBlock &&
      _campaign.totalStaked != 0
    ) {
      uint256 _cursor = _campaign.lastRewardBlock;
      for (uint256 _i; _i != _rewardInfo.length; ) {
        uint256 _multiplier = getMultiplier(
          _cursor,
          block.number,
          _rewardInfo[_i].endBlock
        );
        if (_multiplier != 0) {
          _cursor = _rewardInfo[_i].endBlock;
          _accRewardPerShare =
            _accRewardPerShare +
            ((_multiplier * _rewardInfo[_i].rewardPerBlock * 1e20) /
              _campaign.totalStaked);
        }
        unchecked {
          ++_i;
        }
      }
    }
    return ((_amount * _accRewardPerShare) / 1e20) - _rewardDebt;
  }

  /**
   * @notice Update reward variables of the given campaign to be up-to-date.
   *         NOTE: All rewards relating to periods devoid of any depositors are sent back to the reward manager.
   * @param _campaignID campaign id
   */
  function _updateCampaign(uint256 _campaignID) internal virtual {
    if (_campaignID >= campaignInfo.length) {
      revert InvalidCampaignId();
    }

    CampaignInfo storage campaign = campaignInfo[_campaignID];
    RewardInfo[] memory _rewardInfo = campaignRewardInfo[_campaignID];
    if (block.number <= campaign.lastRewardBlock) {
      return;
    }
    if (campaign.totalStaked == 0) {
      uint256 _amount;
      for (uint256 _i; _i != _rewardInfo.length; ) {
        if (_rewardInfo[_i].endBlock >= campaign.lastRewardBlock) {
          uint256 _startBlock = _i != 0
            ? _rewardInfo[_i - 1].endBlock
            : campaign.lastRewardBlock;
          bool _lastRewardInfo = _rewardInfo[_i].endBlock >
            block.number;
          uint256 _blockRange = (
            _lastRewardInfo ? block.number : _rewardInfo[_i].endBlock
          ) -
            (
              _startBlock > campaign.lastRewardBlock
                ? _startBlock
                : campaign.lastRewardBlock
            );
          _amount += _rewardInfo[_i].rewardPerBlock * _blockRange;
          if (_lastRewardInfo) {
            break;
          }
        }
        unchecked {
          ++_i;
        }
      }

      if (_amount != 0) {
        campaign.rewardToken.safeTransfer(rewardManager, _amount);
      }

      campaign.lastRewardBlock = block.number;

      return;
    }
    /// @dev for each reward info
    for (uint256 _i; _i != _rewardInfo.length; ) {
      // @dev get multiplier based on current Block and rewardInfo's end block
      // multiplier will be a range of either (current block - campaign.lastRewardBlock)
      // or (reward info's endblock - campaign.lastRewardBlock) or 0
      uint256 _multiplier = getMultiplier(
        campaign.lastRewardBlock,
        block.number,
        _rewardInfo[_i].endBlock
      );
      if (_multiplier != 0) {
        // @dev if currentBlock exceed end block, use end block as the last reward block
        // so that for the next iteration, previous endBlock will be used as the last reward block
        if (block.number > _rewardInfo[_i].endBlock) {
          campaign.lastRewardBlock = _rewardInfo[_i].endBlock;
        } else {
          campaign.lastRewardBlock = block.number;
        }
        campaign.accRewardPerShare =
          campaign.accRewardPerShare +
          ((_multiplier * _rewardInfo[_i].rewardPerBlock * 1e20) /
            campaign.totalStaked);
      }
      unchecked {
        ++_i;
      }
    }
  }
}
