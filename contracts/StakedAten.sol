// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./libraries/ERC20withSnapshot.sol";
import "./FixedRateStakeable.sol";
import "./interfaces/IStakedAten.sol";

contract StakedAten is
  IStakedAten,
  ERC20WithSnapshot,
  FixedRateStakeable,
  ReentrancyGuard,
  Ownable
{
  using SafeERC20 for IERC20;
  address public immutable underlyingAssetAddress;
  address public immutable core;

  /**
   * @notice constructs Pool LP Tokens for staking, decimals defaults to 18
   * @param _underlyingAsset is the address of the staked token
   * @param _core is the address of the core contract
   */
  constructor(address _underlyingAsset, address _core)
    ERC20WithSnapshot("ATEN Guarantee Pool Provider Token", "ATEN_GP_LP")
  {
    underlyingAssetAddress = _underlyingAsset;
    core = _core;
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function stake(
    address _account,
    uint256 _amount,
    uint256 _usdDeposit
  ) external override onlyCore {
    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(address(0), _account, _amount);
    IERC20(underlyingAssetAddress).safeTransferFrom(
      _account,
      address(this),
      _amount
    );
    _stake(_account, _amount, _usdDeposit);
    _mint(_account, _amount);
  }

  function setStakeRewards(RewardRate[] calldata _rewardToSet)
    public
    onlyOwner
  {
    _setStakeRewards(_rewardToSet);
  }

  function withdraw(address _account, uint256 _amount)
    external
    override
    onlyCore
  {
    uint256 amountToReturn = _withdrawStake(_account, _amount);
    // we put from & to opposite so as token owner has a Snapshot balance when staking
    _beforeTokenTransfer(_account, address(0), _amount);
    IERC20(underlyingAssetAddress).safeTransfer(_account, amountToReturn);
  }
}
