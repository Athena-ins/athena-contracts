// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// Contracts
import { FarmingRange } from "./FarmingRange.sol";
import { Staking } from "./Staking.sol";

// Libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IRewardManager } from "../interfaces/IRewardManager.sol";
import { IFarmingRange } from "../interfaces/IFarmingRange.sol";
import { IStaking } from "../interfaces/IStaking.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";

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
contract RewardManager is IRewardManager {
  using SafeERC20 for IERC20;

  IFarmingRange public immutable farming;
  IStaking public immutable staking;

  /**
   * @param _owner address who will own the farming
   * @param _liquidityManager address of the liquidity manager
   * @param _coverManager address of the cover manager
   * @param _stakedToken address of the staked token
   * @param _startFarmingCampaign block number the staking pool in the farming will start to give rewards
   * @param feeLevels array of fee discount levels
   */
  constructor(
    address _owner,
    address _liquidityManager,
    address _coverManager,
    IERC20 _stakedToken,
    uint256 _startFarmingCampaign,
    Staking.FeeLevel[] memory feeLevels
  ) {
    if (_startFarmingCampaign <= block.number) {
      revert StartFarmingInPast();
    }

    farming = new FarmingRange(
      _owner,
      address(this),
      _liquidityManager,
      _coverManager
    );
    staking = new Staking(
      _owner,
      _stakedToken,
      farming,
      _liquidityManager
    );

    farming.addCampaignInfo(
      staking,
      _stakedToken,
      _startFarmingCampaign
    );
    staking.initializeFarming(feeLevels);
  }

  function resetAllowance(uint256 _campaignId) external {
    if (_campaignId >= farming.campaignInfoLen()) {
      revert WrongCampaignId();
    }

    (, IERC20 _rewardToken, , , , , ) = farming.campaignInfo(
      _campaignId
    );

    // In case of tokens like USDT, an approval must be set to zero before setting it to another value.
    // Unlike most tokens, USDT does not ignore a non-zero current allowance value, leading to a possible
    // transaction failure when you are trying to change the allowance.
    if (
      _rewardToken.allowance(address(this), address(farming)) != 0
    ) {
      SafeERC20.safeApprove(
        address(_rewardToken),
        address(farming),
        0
      );
    }

    // After ensuring that the allowance is zero (or it was zero to begin with), we then set the allowance to max.
    SafeERC20.safeApprove(
      address(_rewardToken),
      address(farming),
      type(uint256).max
    );
  }
}
