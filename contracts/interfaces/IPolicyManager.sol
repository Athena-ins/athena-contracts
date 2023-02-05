// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPolicyManager is IERC721Enumerable {
  struct Policy {
    uint256 amountCovered;
    uint256 premiumDeposit;
    uint256 atensLocked;
    uint256 beginCoveredTime;
    uint128 poolId;
  }

  struct OngoingCoveragePolicy {
    uint256 policyId;
    uint256 amountCovered;
    uint256 premiumDeposit;
    uint256 premiumLeft;
    uint256 dailyCost;
    uint256 atensLocked;
    uint256 beginCoveredTime;
    uint256 remainingDuration;
    uint128 poolId;
  }

  struct ExpiredPolicy {
    uint256 policyId;
    uint256 amountCovered;
    uint256 premiumDeposit;
    uint256 premiumSpent;
    uint256 atensLocked;
    uint256 beginCoveredTime;
    uint256 endCoveredTime;
    uint128 poolId;
    bool isCancelled;
  }

  function policy(uint256 tokenId) external view returns (Policy memory);

  function mint(
    address to,
    uint256 amountCovered,
    uint256 premiumDeposit,
    uint256 atensLocked,
    uint128 poolId
  ) external returns (uint256);

  function burn(uint256 tokenId) external;

  function saveExpiredPolicy(
    address owner,
    uint256 policyId,
    Policy memory policy,
    uint256 premiumSpent,
    bool isCanceled
  ) external;

  function checkAndGetPolicy(
    address account,
    uint256 policyId,
    uint256 index
  ) external view returns (Policy memory);

  function processExpiredTokens(uint256[] calldata expiredTokens) external;

  function policyActive(uint256 _tokenId) external view returns (bool);

  function poolIdOfPolicy(uint256 _tokenId) external view returns (uint128);

  function getCoverPremiumSpent(uint256 coverId)
    external
    view
    returns (uint256 premiumSpent);
}
