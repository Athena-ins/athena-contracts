// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

interface IClaimManager {
  function getPoolCoverTerms(
    uint64 poolId
  ) external view returns (string memory);

  function claimInitiator(
    uint256 disputeId_
  ) external view returns (address);

  function claimChallenger(
    uint256 claimId_
  ) external view returns (address);

  function addCoverTermsForPool(
    uint64 poolId_,
    string calldata ipfsAgreementCid_
  ) external;
}
