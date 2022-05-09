// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IPolicyCover.sol";

interface IProtocolPool is IPolicyCover {
    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;
}
