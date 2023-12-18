// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// interfaces
import { IStaking } from "./IStaking.sol";
import { IFarmingRange } from "./IFarmingRange.sol";

interface IRewardManager {
  /**
   * @notice used to get the staking contract address
   * @return staking contract address (or Staking contract type in Solidity)
   */
  function staking() external view returns (IStaking);

  /**
   * @notice used to resetAllowance with farming contract to take rewards
   * @param _campaignId campaign id
   */
  function resetAllowance(uint256 _campaignId) external;

  /**
   * @notice used to get the farming contract address
   * @return farming contract address (or FarmingRange contract type in Solidity)
   */
  function farming() external view returns (IFarmingRange);
}
