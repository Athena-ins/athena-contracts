// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault {
    using SafeERC20 for IERC20;

    address private core;

    uint private totalLiquidity;
    IERC20 public stablecoin;

    modifier onlyCore {
        require(msg.sender == core, "Only core");
        _;
    }

    constructor(address stablecoinUsed, address parent) {
        stablecoin = IERC20(stablecoinUsed);
        core = parent;
    }

    function deposit(uint amount, address token) external onlyCore {
        // needs to be stable or ETH or ATEN
        require(token == address(stablecoin), "Wrong ERC20 used for deposit");
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
    }
}