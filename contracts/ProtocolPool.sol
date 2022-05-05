// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./PolicyCover.sol";

contract ProtocolPool is ERC20, Ownable, Pausable, PolicyCover {
    address immutable private core;
    address immutable public underlyingAssetAddress;

    //@dev constructs Pool LP Tokens, decimals defaults to 18
    constructor(
        address _core,
        address _underlyingAsset,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) PolicyCover(_underlyingAsset) {
        core = _core;
        underlyingAssetAddress = _underlyingAsset;
    }

    modifier onlyCore() {
        require(msg.sender == core, "Only Core");
        _;
    }

    function mint(address _account, uint256 _amount) external onlyCore {
        _stake(_account, _amount);
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external onlyCore {
        _unstake(_account, _amount);
        _burn(_account, _amount);
    }
}
