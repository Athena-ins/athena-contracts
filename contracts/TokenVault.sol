// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IVaultERC20.sol";

/// @notice Vault holding the locked supply of ATEN rewards
contract TokenVault is IVaultERC20 {
  using SafeERC20 for IERC20;
  address public immutable core;

  IERC20 public atenTokenInterface;

  constructor(address tokenAddress_, address core_) {
    atenTokenInterface = IERC20(tokenAddress_);
    core = core_;
  }

  /// ============================ ///
  /// ========= MODIFIERS ======== ///
  /// ============================ ///

  modifier onlyCore() {
    require(msg.sender == core, "TV: only core");
    _;
  }

  /// ================================= ///
  /// ========= DEPOSIT & SEND ======== ///
  /// ================================= ///

  /**
   * @notice
   * Sends policy or general staking rewards to a user
   * @param to_ the address of the user
   * @param amount_ the amount of rewards to send
   */
  function sendReward(address to_, uint256 amount_) external onlyCore {
    // Check if the contract has enough tokens
    uint256 vaultBalance = atenTokenInterface.balanceOf(address(this));
    require(amount_ <= vaultBalance, "TV: insufficient balance");

    // Transfer the amount to the user
    atenTokenInterface.transfer(to_, amount_);
  }
}
