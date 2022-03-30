// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract PositionManager is ERC1155 {

    struct Position {
        uint providedLiquidity;
        // alternative would be mapping id to protocol data 
        // like amount for Protocol, ...
        uint128[] protocolsId;
    }

    address private core;

    Position[] private _positions;

    modifier onlyCore {
        require(msg.sender == core, "Only core");
        _;
    }
    constructor(address coreAddress) ERC1155("https://athena-co.io") {
        core = coreAddress;
    }
    
    function provideProtocolFund(uint128[] calldata protocolsId) external payable returns (bool) {
        // @dev : check protocols compatibility, and existence or revert. 
        // Explicit or implicit protocol ?
        _positions.push(Position({
            providedLiquidity: 0,
            protocolsId: protocolsId
        }));
        return true;
    }

    function burn(uint256 tokenId, uint amount) external {
        Position storage position = _positions[tokenId];
        require(position.providedLiquidity == 0, "Not cleared");
        delete _positions[tokenId];
        _burn(msg.sender, tokenId, amount);
    }

    function mint(address to, uint id, uint amount, bytes calldata data) external onlyCore returns (bool) {
        _mint(to, id, amount, data);
    }

    // function _safeMint() internal {

    // }

}