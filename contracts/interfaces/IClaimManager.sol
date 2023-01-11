// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IClaimManager {
  function getProtocolAgreement(uint256 poolId)
    external
    view
    returns (string memory);

  function claimInitiator(uint256 disputeId_) external view returns (address);

  function claimChallenger(uint256 claimId_) external view returns (address);

  function addAgreementForProtocol(
    uint256 poolId_,
    string calldata agreementIpfsHash_
  ) external;
}
