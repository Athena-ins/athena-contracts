// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPolicyManager is IERC721Enumerable {
    function policies(uint256 _tokenId)
        external
        view
        returns (uint256 liquidity, uint128[] memory protocolsId);

    function mint(
        address to,
        uint256 capitalGuaranteed,
        uint256 atensLocked,
        uint128 _protocolId
    ) external;

    function burn(address to) external;

    function update(
        address to,
        uint128 _discount,
        uint256 amount,
        uint256 atenStake,
        uint128[] calldata _protocolsIds,
        uint256 tokenId
    ) external;
}
