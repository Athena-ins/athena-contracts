// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IPolicyManager is IERC721Enumerable {
  struct Policy {
    uint256 amountCovered;
    uint256 paidPremium;
    uint256 atensLocked;
    uint256 beginCoveredTime;
    uint128 protocolId;
  }

  struct ExpiredPolicy {
    uint256 amountCovered;
    uint256 paidPremium;
    uint256 actualFees;
    uint256 atensLocked;
    uint256 beginCoveredTime;
    uint256 endCoveredTime;
    uint128 protocolId;
    bool isCanceled;
  }

  function policy(uint256 tokenId) external view returns (Policy memory);

  function mint(
    address to,
    uint256 amountCovered,
    uint256 paidPremium,
    uint256 atensLocked,
    uint128 protocolId
  ) external returns (uint256);

  function burn(uint256 tokenId) external;

  function saveExpiredPolicy(
    address owner,
    Policy memory policy,
    uint256 actualFees,
    bool isCanceled
  ) external;

  function checkAndGetPolicy(
    address account,
    uint256 policyId,
    uint256 index
  ) external view returns (Policy memory);

  function processExpiredTokens(uint256[] calldata expiredTokens) external;
}
