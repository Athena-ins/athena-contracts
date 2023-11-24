// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IClaimManager {
  function getPoolCoverTerms(
    uint128 poolId
  ) external view returns (string memory);

  function claimInitiator(
    uint256 disputeId_
  ) external view returns (address);

  function claimChallenger(
    uint256 claimId_
  ) external view returns (address);

  function addCoverTermsForPool(
    uint128 poolId_,
    string calldata ipfsAgreementCid_
  ) external;
}
