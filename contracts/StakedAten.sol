// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./FixedRateStakeable.sol";

contract StakedAten is ERC20, FixedRateStakeable, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    address public immutable underlyingAssetAddress;
    address public immutable core;

    //@dev constructs Pool LP Tokens, decimals defaults to 18
    constructor(address _underlyingAsset, address _core)
        ERC20("ATEN Guarantee Pool Provider Token", "ATEN_GP_LP")
    {
        underlyingAssetAddress = _underlyingAsset;
        core = _core;
    }

    modifier onlyCore() {
        require(msg.sender == core, "Only Core");
        _;
    }

    function stake(uint256 _amount) public onlyCore {
        IERC20(underlyingAssetAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        _stake(_amount);
    }

    function setStakeRewards(RewardRate[] calldata _rewardToSet)
        public
        onlyOwner
    {
        _setStakeRewards(_rewardToSet);
    }
}
