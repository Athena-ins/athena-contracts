// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// Contracts
import { FarmingRange } from "./FarmingRange.sol";
import { Staking } from "./Staking.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IRewardManager } from "../interfaces/IRewardManager.sol";
import { IFarmingRange } from "../interfaces/IFarmingRange.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IEcclesiaDao } from "../interfaces/IEcclesiaDao.sol";
import { IAthenaPositionToken } from "../interfaces/IAthenaPositionToken.sol";
import { IAthenaCoverToken } from "../interfaces/IAthenaCoverToken.sol";
import { IOwnable } from "../interfaces/IOwnable.sol";

//======== ERRORS ========//

// Start farming is in the past
error StartFarmingInPast();
// Wrong campaign ID
error WrongCampaignId();

/**
 * @title RewardManager
 * @notice RewardManager handles the creation of the contract staking and farming, automatically create a campaignInfo
 * in the farming for the staking, at slot 0 and initialize farming. The RewardManager is the owner of the funds in
 * the FarmingRange, only the RewardManager is capable of sending funds to be farmed and only the RewardManager will get
 * the funds back when updating of removing campaigns.
 */
contract RewardManager is IRewardManager, Ownable {
  using SafeERC20 for IERC20;

  IFarmingRange public immutable farming;
  IStaking public immutable staking;

  /**
   * @param _liquidityManager address of the liquidity manager
   * @param _positionToken address of the position token
   * @param _coverToken address of the cover token
   * @param _stakedToken address of the staked token
   * @param _startFarmingCampaign block number the staking pool in the farming will start to give rewards
   * @param feeLevels array of fee discount levels
   */
  constructor(
    ILiquidityManager _liquidityManager,
    IEcclesiaDao _ecclesiaDao,
    IAthenaPositionToken _positionToken,
    IAthenaCoverToken _coverToken,
    IERC20 _stakedToken,
    uint256 _startFarmingCampaign,
    Staking.FeeLevel[] memory feeLevels
  ) Ownable(msg.sender) {
    if (_startFarmingCampaign <= block.number) {
      revert StartFarmingInPast();
    }

    farming = new FarmingRange(
      address(this),
      _liquidityManager,
      _positionToken,
      _coverToken
    );
    staking = new Staking(
      _stakedToken,
      farming,
      _liquidityManager,
      _ecclesiaDao
    );

    farming.addCampaignInfo(
      IFarmingRange.AssetType.ERC20,
      1e18, // Use impossibly high pool ID
      staking,
      _stakedToken,
      _startFarmingCampaign
    );
    staking.initializeFarming(feeLevels);

    IOwnable(address(farming)).transferOwnership(msg.sender);
    IOwnable(address(staking)).transferOwnership(msg.sender);
  }

  function resetAllowance(uint256 _campaignId) external {
    if (_campaignId >= farming.campaignInfoLen()) {
      revert WrongCampaignId();
    }

    (, , , IERC20 _rewardToken, , , , , ) = farming.campaignInfo(
      _campaignId
    );

    // In case of tokens like USDT, an approval must be set to zero before setting it to another value.
    // Unlike most tokens, USDT does not ignore a non-zero current allowance value, leading to a possible
    // transaction failure when you are trying to change the allowance.
    // After ensuring that the allowance is zero (or it was zero to begin with), we then set the allowance to max.
    SafeERC20.forceApprove(
      _rewardToken,
      address(farming),
      type(uint256).max
    );
  }

  function withdraw(
    address token_,
    uint256 amount_
  ) external onlyOwner {
    if (token_ == address(0)) {
      // @dev It is acceptable to use transfer here since the owner trusted
      payable(msg.sender).transfer(amount_);
    } else {
      IERC20(token_).safeTransfer(msg.sender, amount_);
    }
  }
}
