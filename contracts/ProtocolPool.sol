// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ProtocolPool is ERC20, ReentrancyGuard, Ownable, Pausable {
    address immutable core;
    address immutable underlyingAssetAddress; 

    //@dev constructs Pool LP Tokens, decimals defaults to 18
    constructor(
        address _core,
        address _underlyingAsset,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        core = _core;
        underlyingAssetAddress = _underlyingAsset;
    }
}
