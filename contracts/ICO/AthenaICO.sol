// SPDX-License-Identifier: MIT

pragma solidity ^0.8;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AthenaICO is Ownable {

    using SafeERC20 for IERC20;

    mapping(address => bool) public authTokens;

    address immutable public ATEN = 0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283;

    uint private presaleUsers = 0;
    mapping(address => uint) private presales;
    address[] private users;

    constructor(address[] memory tokens) {
        for (uint256 i = 0; i < tokens.length; i++) {
            authTokens[tokens[i]] = true;   
        }
    }

    function mint(uint amount, address token, address to) public {
        require(authTokens[token] == true, "Not approved Token for this ICO");
        // Safe Transfer will revert if not successful
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if(presales[msg.sender] == 0){
            presaleUsers++;
        }
        // NEED CONVERSION VALUE ? SWAP AT THIS TIME ? OR CONVERT value only for reference ?
        presales[to] += amount; // DANGER IF DIFFERENT TOKENS AND NO CONVERSION
        // What about mint again for user ??

    }

    function distribute(address from) external onlyOwner {
        for (uint256 i = 0; i < presaleUsers; i++) {
            IERC20(ATEN).safeTransferFrom(from, users[i], presales[users[i]]);
        }
    }
}