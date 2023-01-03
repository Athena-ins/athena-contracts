// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IVaultERC20.sol";

/// @notice Vault holding the locked supply of ATEN rewards
contract TokenVault is IVaultERC20 {
  uint256 private constant MAX_UINT256 = type(uint256).max;
  address public immutable underlyingAssetAddress;
  address public immutable core;
  mapping(address => uint256) public userBalances;

  constructor(address _tokenAddress, address _core) {
    underlyingAssetAddress = _tokenAddress;
    core = _core;
    IERC20(underlyingAssetAddress).approve(_core, MAX_UINT256);
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  function deposit(uint256 _amount) external {
    require(
      IERC20(underlyingAssetAddress).balanceOf(msg.sender) >= _amount,
      "Insufficient balance for deposit"
    );
    IERC20(underlyingAssetAddress).transferFrom(
      msg.sender,
      address(this),
      _amount
    );
    // userBalances[msg.sender] += _amount;
  }

  function transfer(address _account, uint256 _amount) external onlyCore {
    require(
      IERC20(underlyingAssetAddress).balanceOf(address(this)) >= _amount,
      "Insufficient balance for transfer"
    );
    // userBalances[msg.sender] -= _amount;
    IERC20(underlyingAssetAddress).transfer(_account, _amount);
  }

  /**
   * @notice
   * Sends policy or general staking rewards to a user
   * @param to_ the address of the user
   * @param amount_ the amount of rewards to send
   */
  function sendReward(address to_, uint256 amount_) external onlyCore {
    // Check if the contract has enough tokens
    require(
      amount_ <= IERC20(underlyingAssetAddress).balanceOf(address(this)),
      "AV: insufficient balance"
    );

    // Transfer the amount to the user
    IERC20(underlyingAssetAddress).transfer(to_, amount_);
  }
}
