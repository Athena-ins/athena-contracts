// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AAVELPToken is ERC20, ReentrancyGuard {
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public precision = 1e18;
    address public aToken;
    address public core;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public totalShares;
    mapping(address => uint256) private _balances;

    constructor(address _aToken, address _core)
        ERC20("AAVE_LP_ATHENA", "AAVE LP x ATHENA Token")
    {   
        aToken = _aToken;
        core = _core;
    }

    modifier onlyCore() {
        require(msg.sender == core, "Only Core");
        _;
    }

    function mint(address _account, uint256 _amount) external onlyCore {
        uint256 share = _amount / underlyingBalance(address(this));
        _mint(_account, share);
    }

    function underlyingBalance(address _account)
        internal
        view
        returns (uint256)
    {
        return ERC20(aToken).balanceOf(_account);
    }

    function withdraw(address _account, uint256 _amount) external onlyCore {
        require(_amount > 0, "Amount must be greater than 0");
        _burn(_account, _amount);
        //@dev TODO LOCK CHECK OR COOLDOWN
    }
}
