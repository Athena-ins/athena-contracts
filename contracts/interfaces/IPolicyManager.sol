// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPolicyManager is IERC721Enumerable {
  struct Policy {
    uint128 poolId;
    bool cancelledByUser;
    uint256 amountCovered;
    uint256 premiumDeposit;
    uint256 beginCoveredTime;
    uint256 endTimestamp;
  }

  struct FullCoverData {
    uint256 coverId;
    uint128 poolId;
    bool cancelledByUser;
    uint256 amountCovered;
    uint256 premiumDeposit;
    uint256 beginCoveredTime;
    uint256 endTimestamp;
    uint256 premiumLeft;
    uint256 dailyCost;
    uint256 remainingDuration;
  }

  function allPolicyTokensOfOwner(address owner)
    external
    view
    returns (uint256[] calldata tokenList);

  function getCover(uint256 coverId) external view returns (Policy calldata);

  function policy(uint256 tokenId) external view returns (Policy memory);

  function mint(
    address to,
    uint256 amountCovered,
    uint256 premiumDeposit,
    uint128 poolId
  ) external returns (uint256);

  function increaseCover(uint256 coverId_, uint256 amount_) external;

  function decreaseCover(uint256 coverId_, uint256 amount_) external;

  function addPremiums(uint256 coverId_, uint256 amount_) external;

  function removePremiums(uint256 coverId_, uint256 amount_) external;

  function expireCover(uint256 coverId, bool cancelledByUser) external;

  function processExpiredTokens(uint256[] calldata expiredTokens) external;

  function policyActive(uint256 _tokenId) external view returns (bool);

  function poolIdOfPolicy(uint256 _tokenId) external view returns (uint128);

  function getCoverPremiumSpent(uint256 coverId)
    external
    view
    returns (uint256 premiumSpent);
}
