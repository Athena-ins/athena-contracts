// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IVaultERC20.sol";

/// @notice Vault holding the locked supply of ATEN rewards
contract TokenVault is IVaultERC20 {
  using SafeERC20 for IERC20;
  address public immutable core;

  IERC20 public atenTokenInterface;

  uint256 public coverRefundRewardsTotal;
  uint256 public stakingRewardsTotal;

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

  function depositCoverRefundRewards(uint256 amount_) external {
    // Transfer the ATEN to the vault
    atenTokenInterface.safeTransferFrom(msg.sender, address(this), amount_);

    coverRefundRewardsTotal += amount_;
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
   * Sends cover refund rewards to a user
   * @param to_ the address of the user
   * @param amount_ the amount of rewards to send
   */
  function sendCoverRefundReward(address to_, uint256 amount_)
    external
    onlyCore
  {
    if (amount_ == 0 || coverRefundRewardsTotal == 0) return;

    // Check if the contract has enough tokens
    if (amount_ <= coverRefundRewardsTotal) {
      // We can allow unchecked because of the above check
      unchecked {
        coverRefundRewardsTotal -= amount_;
      }
      atenTokenInterface.transfer(to_, amount_);
    } else {
      atenTokenInterface.transfer(to_, coverRefundRewardsTotal);
      coverRefundRewardsTotal = 0;
    }
  }

  /**
   * @notice
   * Sends general staking rewards to a user
   * @param to_ the address of the user
   * @param amount_ the amount of rewards to send
   */
  function sendStakingReward(address to_, uint256 amount_) external onlyCore {
    if (amount_ == 0 || stakingRewardsTotal == 0) return;

    // Check if the contract has enough tokens
    if (amount_ <= stakingRewardsTotal) {
      // We can allow unchecked because of the above check
      unchecked {
        stakingRewardsTotal -= amount_;
      }
      atenTokenInterface.transfer(to_, amount_);
    } else {
      atenTokenInterface.transfer(to_, stakingRewardsTotal);
      stakingRewardsTotal = 0;
    }
  }

  /// ======================== ///
  /// ========= ADMIN ======== ///
  /// ======================== ///

  function syncBalances() external {
    // Reject contract calls to secure the function
    if (msg.sender != tx.origin) revert TV_SenderMustBeEOA();

    uint256 atenBalance = atenTokenInterface.balanceOf(address(this));

    if (coverRefundRewardsTotal + stakingRewardsTotal < atenBalance) {
      stakingRewardsTotal = atenBalance - coverRefundRewardsTotal;
    }
  }
}
