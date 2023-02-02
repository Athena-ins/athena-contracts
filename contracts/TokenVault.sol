// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IVaultERC20.sol";

/// @notice Vault holding the locked supply of ATEN rewards
contract TokenVault is IVaultERC20 {
  using SafeERC20 for IERC20;
  address public immutable core;

  IERC20 public atenTokenInterface;

  uint256 policyRefundRewardsTotal;
  uint256 stakingRewardsTotal;

  constructor(address tokenAddress_, address core_) {
    atenTokenInterface = IERC20(tokenAddress_);
    core = core_;
  }

  /// ========================= ///
  /// ========= ERRORS ======== ///
  /// ========================= ///

  error TV_SenderIsNotCore();
  error TV_SenderMustBeEOA();

  /// ============================ ///
  /// ========= MODIFIERS ======== ///
  /// ============================ ///

  modifier onlyCore() {
    if (msg.sender != core) revert TV_SenderIsNotCore();
    _;
  }

  /// ========================== ///
  /// ========= DEPOSIT ======== ///
  /// ========================== ///

  function depositPolicyRefundRewards(uint256 amount_) external {
    // Transfer the ATEN to the vault
    atenTokenInterface.safeTransferFrom(msg.sender, address(this), amount_);

    policyRefundRewardsTotal += amount_;
  }

  function depositStakingRewards(uint256 amount_) external {
    // Transfer the ATEN to the vault
    atenTokenInterface.safeTransferFrom(msg.sender, address(this), amount_);

    stakingRewardsTotal += amount_;
  }

  /// ======================= ///
  /// ========= SEND ======== ///
  /// ======================= ///

  /**
   * @notice
   * Sends policy refund rewards to a user
   * @param to_ the address of the user
   * @param amount_ the amount of rewards to send
   */
  function sendPolicyRefundReward(address to_, uint256 amount_)
    external
    onlyCore
  {
    if (policyRefundRewardsTotal == 0) return;

    // Check if the contract has enough tokens
    if (amount_ <= policyRefundRewardsTotal) {
      policyRefundRewardsTotal = 0;
      atenTokenInterface.transfer(to_, policyRefundRewardsTotal);
    } else {
      policyRefundRewardsTotal -= amount_;
      atenTokenInterface.transfer(to_, amount_);
    }
  }

  /**
   * @notice
   * Sends general staking rewards to a user
   * @param to_ the address of the user
   * @param amount_ the amount of rewards to send
   */
  function sendStakingReward(address to_, uint256 amount_) external onlyCore {
    if (stakingRewardsTotal == 0) return;

    // Check if the contract has enough tokens
    if (amount_ <= stakingRewardsTotal) {
      stakingRewardsTotal = 0;
      atenTokenInterface.transfer(to_, stakingRewardsTotal);
    } else {
      stakingRewardsTotal -= amount_;
      atenTokenInterface.transfer(to_, amount_);
    }
  }

  /// ======================== ///
  /// ========= ADMIN ======== ///
  /// ======================== ///

  function syncBalances() external {
    // Reject contract calls to secure the function
    if (msg.sender != tx.origin) revert TV_SenderMustBeEOA();

    uint256 atenBalance = atenTokenInterface.balanceOf(address(this));

    if (policyRefundRewardsTotal + stakingRewardsTotal < atenBalance) {
      stakingRewardsTotal = atenBalance - policyRefundRewardsTotal;
    }
  }
}
