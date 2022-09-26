// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPolicyManager is IERC721Enumerable {
  function policy(uint256 _tokenId)
    external
    view
    returns (uint256 liquidity, uint128 protocolId);

  function mint(
    address to,
    uint256 amountCovered,
    uint256 paidPremium,
    uint256 atensLocked,
    uint128 protocolId
  ) external returns (uint256);

  function burn(uint256 tokenId) external;

  function checkAndGetPolicy(
    address account,
    uint256 policyId,
    uint256 index
  ) external returns (uint256 amountCovered, uint128 protocolId);
}
