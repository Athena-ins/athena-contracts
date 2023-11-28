// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// libraries
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { IFarmingRange } from "./interfaces/IFarmingRange.sol";
import { IStaking } from "./interfaces/IStaking.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";

//======== ERRORS ========//

// Farming campaign not initialized
error FarmingCampaignNotInitialized();
// User already called deposit or withdraw this block
error UserAlreadyCalledDepositOrWithdrawThisBlock();
// Aten token is not defined
error AtenTokenIsNotDefined();
// Liquidity manager is not defined
error LiquidityManagerIsNotDefined();
// Farming is not defined
error FarmingIsNotDefined();
// Farming campaign already initialized
error FarmingCampaignAlreadyInitialized();
// Can't deposit zero token
error CantDepositZeroToken();
// No new shares received
error NoNewSharesReceived();
// Can't withdraw more than user shares or zero
error CantWithdrawMoreThanUserSharesOrZero();
// No shares to withdraw
error NoSharesToWithdraw();

/**
 * @title FarmingRange
 * @notice Staking campaign that is compatible with the Farming Range contract campaigns. Allows users to stake AOE Tokens to receive AOE rewards
 * @custom:source Inspired by ERC-4626 Tokenized Vault Standard
 * @custom:url https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/extensions/ERC4626.sol
 */
contract Staking is IStaking, ERC20, Ownable {
  using SafeERC20 for IERC20;

  uint256 public constant CAMPAIGN_ID = 0;
  uint256 internal constant SHARES_FACTOR = 1e18;
  uint256 public constant MINIMUM_SHARES = 10 ** 3;

  IERC20 public immutable stakedToken;
  IFarmingRange public immutable farming;

  mapping(address => UserInfo) public userInfo;
  uint256 public totalShares;
  bool public farmingInitialized = false;

  ILiquidityManager public liquidityManager;

  modifier isFarmingInitialized() {
    if (farmingInitialized == false) {
      revert FarmingCampaignNotInitialized();
    }
    _;
  }

  modifier checkUserBlock() {
    if (userInfo[msg.sender].lastBlockUpdate >= block.number) {
      revert UserAlreadyCalledDepositOrWithdrawThisBlock();
    }
    userInfo[msg.sender].lastBlockUpdate = block.number;
    _;
  }

  constructor(
    address _owner,
    IERC20 _stakedToken,
    IFarmingRange _farming,
    ILiquidityManager liquidityManager_
  ) ERC20("Staked Aten Token", "stAOE") Ownable(_owner) {
    if (address(_stakedToken) == address(0)) {
      revert AtenTokenIsNotDefined();
    }
    if (address(_farming) == address(0)) {
      revert FarmingIsNotDefined();
    }
    if (address(liquidityManager) == address(0)) {
      revert LiquidityManagerIsNotDefined();
    }

    stakedToken = _stakedToken;
    farming = _farming;
    liquidityManager = liquidityManager_;
  }

  /// @inheritdoc IStaking
  function initializeFarming(FeeLevel[] memory feeLevels) external {
    if (farmingInitialized == true) {
      revert FarmingCampaignAlreadyInitialized();
    }

    setFeeLevelsWithAten(feeLevels);

    _approve(address(this), address(farming), 1 wei);
    _mint(address(this), 1 wei);
    farming.deposit(CAMPAIGN_ID, 1 wei);

    farmingInitialized = true;
  }

  /// @inheritdoc IStaking
  function deposit(
    uint256 _depositAmount
  ) public isFarmingInitialized checkUserBlock {
    if (_depositAmount == 0) {
      revert CantDepositZeroToken();
    }

    harvestFarming();

    uint256 _currentBalance = stakedToken.balanceOf(address(this));
    uint256 _newShares = _tokensToShares(
      _depositAmount,
      _currentBalance
    );

    uint256 _userNewShares;
    if (totalShares == 0) {
      _userNewShares = _newShares - MINIMUM_SHARES;
    } else {
      _userNewShares = _newShares;
    }
    if (_userNewShares == 0) revert NoNewSharesReceived();

    userInfo[msg.sender].shares += _userNewShares;
    totalShares += _newShares;

    stakedToken.safeTransferFrom(
      msg.sender,
      address(this),
      _depositAmount
    );

    _updateAccountFeeDiscount(
      userInfo[msg.sender].shares,
      _currentBalance
    );

    emit Deposit(msg.sender, _depositAmount, _userNewShares);
  }

  /// @inheritdoc IStaking
  function depositWithPermit(
    uint256 _depositAmount,
    bool _approveMax,
    uint256 _deadline,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) external {
    IERC20Permit(address(stakedToken)).permit(
      msg.sender,
      address(this),
      _approveMax ? type(uint256).max : _depositAmount,
      _deadline,
      _v,
      _r,
      _s
    );

    deposit(_depositAmount);
  }

  /// @inheritdoc IStaking
  function withdraw(
    address _to,
    uint256 _sharesAmount
  ) external isFarmingInitialized checkUserBlock {
    if (
      _sharesAmount == 0 ||
      userInfo[msg.sender].shares < _sharesAmount
    ) {
      revert CantWithdrawMoreThanUserSharesOrZero();
    }

    harvestFarming();

    uint256 _currentBalance = stakedToken.balanceOf(address(this));
    uint256 _tokensToWithdraw = _sharesToTokens(
      _sharesAmount,
      _currentBalance
    );

    userInfo[msg.sender].shares -= _sharesAmount;
    totalShares -= _sharesAmount;
    stakedToken.safeTransfer(_to, _tokensToWithdraw);

    _updateAccountFeeDiscount(
      userInfo[msg.sender].shares,
      _currentBalance
    );

    emit Withdraw(msg.sender, _to, _tokensToWithdraw, _sharesAmount);
  }

  /// @inheritdoc IStaking
  function emergencyWithdraw(
    address _to
  ) external isFarmingInitialized checkUserBlock {
    if (userInfo[msg.sender].shares == 0) {
      revert NoSharesToWithdraw();
    }

    uint256 _sharesAmount = userInfo[msg.sender].shares;
    uint256 _currentBalance = stakedToken.balanceOf(address(this));
    uint256 _tokensToWithdraw = _sharesToTokens(
      _sharesAmount,
      _currentBalance
    );

    totalShares -= _sharesAmount;
    userInfo[msg.sender].shares = 0;
    stakedToken.safeTransfer(_to, _tokensToWithdraw);

    feeDiscountOf[msg.sender] = 0;
    liquidityManager.feeDiscountUpdate(msg.sender, 0);

    emit EmergencyWithdraw(
      msg.sender,
      _to,
      _tokensToWithdraw,
      _sharesAmount
    );
  }

  /// @inheritdoc IStaking
  function harvestFarming() public {
    farming.withdraw(CAMPAIGN_ID, 0);
  }

  /// @inheritdoc IStaking
  function tokensToShares(
    uint256 _tokens
  ) external view returns (uint256 shares_) {
    uint256 _currentBalance = stakedToken.balanceOf(address(this));
    _currentBalance += farming.pendingReward(
      CAMPAIGN_ID,
      address(this)
    );

    shares_ = _tokensToShares(_tokens, _currentBalance);
  }

  /// @inheritdoc IStaking
  function sharesToTokens(
    uint256 _shares
  ) external view returns (uint256 tokens_) {
    uint256 _currentBalance = stakedToken.balanceOf(address(this));
    _currentBalance += farming.pendingReward(
      CAMPAIGN_ID,
      address(this)
    );

    tokens_ = _sharesToTokens(_shares, _currentBalance);
  }

  /**
   * @notice Calculate shares qty for an amount of AOE tokens
   * @param _tokens user qty of AOE to be converted to shares
   * @param _currentBalance contract balance AOE. _tokens <= _currentBalance
   * @return shares_ shares equivalent to the token amount. _shares <= totalShares
   */
  function _tokensToShares(
    uint256 _tokens,
    uint256 _currentBalance
  ) internal view returns (uint256 shares_) {
    shares_ = totalShares != 0
      ? (_tokens * totalShares) / _currentBalance
      : _tokens * SHARES_FACTOR;
  }

  /**
   * @notice Calculate shares values in AOE tokens
   * @param _shares amount of shares. _shares <= totalShares
   * @param _currentBalance contract balance in AOE
   * @return tokens_ qty of AOE token equivalent to the _shares. tokens_ <= _currentBalance
   */
  function _sharesToTokens(
    uint256 _shares,
    uint256 _currentBalance
  ) internal view returns (uint256 tokens_) {
    tokens_ = totalShares != 0
      ? (_shares * _currentBalance) / totalShares
      : _shares / SHARES_FACTOR;
  }

  //======== FEE DISCOUNT ========//

  struct FeeLevel {
    uint256 atenAmount;
    uint256 feeDiscount; // (10_000 = 100% discount)
  }
  // Performance fee discount levels
  FeeLevel[] public feeLevels;

  mapping(address account => uint256 feeDiscount)
    public feeDiscountOf;

  function _updateAccountFeeDiscount(
    uint256 _shares,
    uint256 _currentBalance
  ) internal {
    uint256 tokenBalance = _sharesToTokens(_shares, _currentBalance);

    uint256 feeDiscount = feeDiscountOf[msg.sender];
    uint256 newFeeDiscount = amountToFeeDiscount(tokenBalance);

    if (feeDiscount != newFeeDiscount) {
      feeDiscountOf[msg.sender] = newFeeDiscount;
      liquidityManager.feeDiscountUpdate(msg.sender, newFeeDiscount);
    }
  }

  /** @notice
   * Gets all the cover supply fee levels according to the amount of staked ATEN.
   * @return levels all the fee levels
   **/
  function getSupplyFeeLevels()
    public
    view
    returns (FeeLevel[] memory levels)
  {
    uint256 nbLevels = supplyFeeLevels.length;
    levels = new FeeLevel[](nbLevels);

    for (uint256 i = 0; i < nbLevels; i++) {
      levels[i] = supplyFeeLevels[i];
    }
  }

  /** @notice
   * Retrieves the fee discount according to amount of staked ATEN.
   * @dev Returns displays warning but levels require an amountAten of 0
   * @param stakedAten_ amount of ATEN the user stakes in GP
   * @return _ amount of fees applied to cover supply interests
   **/
  function amountToFeeDiscount(
    uint256 stakedAten_
  ) public view returns (uint128) {
    // Lazy check to avoid loop if user doesn't stake
    if (stakedAten_ == 0) return supplyFeeLevels[0].feeDiscount;

    // Inversed loop starts with the end to find adequate level
    for (uint256 i = supplyFeeLevels.length - 1; 0 <= i; i--) {
      // Rate level with atenAmount of 0 will always be true
      if (supplyFeeLevels[i].atenAmount <= stakedAten_)
        return supplyFeeLevels[i].feeDiscount;
    }

    return supplyFeeLevels[0].feeDiscount;
  }

  /** @notice
   * Set the fee levels on cover interests according to amount of staked ATEN in general pool.
   * @dev Levels must be in ascending order of atenAmount
   * @dev The atenAmount indicates the upper limit for the level
   * @param levels_ array of fee level structs
   **/
  function setFeeLevelsWithAten(
    FeeLevel[] calldata levels_
  ) public onlyOwner {
    // First clean the storage
    // @bw does not clear storage in classic manner, need to check
    delete supplyFeeLevels;

    // Set all cover supply fee levels
    uint256 previousAtenAmount = 0;
    for (uint256 i = 0; i < levels_.length; i++) {
      FeeLevel calldata level = levels_[i];

      if (i == 0) {
        // Require that the first level indicates fees for atenAmount 0
        if (level.atenAmount != 0) revert MissingBaseRate();
      } else {
        // If it isn't the first item check that items are ascending
        if (level.atenAmount < previousAtenAmount)
          revert MustSortInAscendingOrder();

        previousAtenAmount = level.atenAmount;
      }

      // Check that fee discount is not higher than 100%
      if (10_000 < level.feeDiscount) revert GreaterThan100Percent();

      // save to storage
      supplyFeeLevels.push(level);
    }
  }
}
