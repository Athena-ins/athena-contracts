// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/IPositionsManager.sol";
import "./library/PositionsLibrary.sol";

contract PositionsManager is IPositionsManager, ERC721Enumerable {
    struct Position {
        address owner;
        uint256 providedLiquidity;
        //Aten to stake with position in stable
        uint256 atens;
        uint128 discount;
        // alternative would be mapping id to protocol data
        // like amount for Protocol, ...
        PositionsLibrary.ProtocolPosition[] protocolsPositions;
    }

    address private core;

    /// @dev The token ID position data
    mapping(uint256 => Position) private _positions;

    /// @dev The ID of the next token that will be minted.
    uint176 private _nextId = 0;

    modifier onlyCore() {
        require(msg.sender == core, "Only core");
        _;
    }

    constructor(address coreAddress) ERC721("ATHENA", "athena-co.io") {
        core = coreAddress;
    }

    // function burn(uint256 tokenId, uint256 amount) external {
    //     Position storage position = _positions[tokenId];
    //     require(position.providedLiquidity == 0, "Not cleared");
    //     delete _positions[tokenId];
    //     _burn(msg.sender, tokenId, amount);
    // }

    function positions(uint256 tokenId)
        external
        view
        returns (
            uint256 liquidity,
            PositionsLibrary.ProtocolPosition[] memory protocols
        )
    {
        Position memory position = _positions[tokenId];
        return (position.providedLiquidity, position.protocolsPositions);
    }

    function addLiquidity(
        address to,
        uint128 _discount,
        uint256 amount,
        uint256 atenStake,
        PositionsLibrary.ProtocolPosition[] calldata _protocolsPositions
    ) external override onlyCore {
        _positions[_nextId] = Position({
            owner: to,
            providedLiquidity: amount,
            discount: _discount,
            protocolsPositions: _protocolsPositions,
            atens: atenStake
        });
        _mint(to, _nextId);
        _nextId++;
    }

    // function _safeMint() internal {

    // }
}
