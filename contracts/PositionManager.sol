// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract PositionManager is ERC721 {

    struct Position {
        uint providedLiquidity;
        uint128[] protocolsId;
    }

    Position[] private _positions;

    constructor() ERC721("ATHENA", "ATENLP") {

    }

    modifier isAuthorizedForToken(uint256 tokenId) {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not approved");
        _;
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

    function burn(uint256 tokenId) external payable isAuthorizedForToken(tokenId) {
        Position storage position = _positions[tokenId];
        require(position.providedLiquidity == 0, "Not cleared");
        delete _positions[tokenId];
        _burn(tokenId);
    }

    // function _safeMint() internal {

    // }

}