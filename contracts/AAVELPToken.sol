// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AAVELPToken is ERC20, ReentrancyGuard {
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public precision = 1e18;
    address public asset;
    address public core;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public totalShares;
    mapping(address => uint256) private _balances;

    constructor(address _asset, address _core)
        ERC20("AAVE_LP_ATHENA", "AAVE LP x ATHENA Token")
    {   
        asset = _asset;
        core = _core;
    }

    modifier onlyCore() {
        require(msg.sender == core, "Only Core");
        _;
    }

    function deposit(address _account, uint256 _amount) external onlyCore {
        uint256 share = _amount / underlyingBalance(address(this));
        _mint(_account, share);
    }

    function underlyingBalance(address _account)
        internal
        view
        returns (uint256)
    {
        return ERC20(asset).balanceOf(_account);
    }

    function totalAssets() public view returns (uint256) {
        return ERC20(asset).balanceOf(address(this));
    }

    function convertToShares(uint256 _assets) public view returns (uint256) {
        return _assets / underlyingBalance(address(this));
    }

    function convertToAssets(uint256 _shares) public view returns (uint256) {
        return _shares / totalAssets();
    }

    function maxDeposit() public pure returns (uint256) {
        return 2 ** 256 - 1;
    }

    function withdraw(address _account, uint256 _amount) external onlyCore {
        require(_amount > 0, "Amount must be greater than 0");
        _burn(_account, _amount);
        //@dev TODO LOCK CHECK OR COOLDOWN
    }
}
