// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IClaimManager {
  function claimInitiator(uint256 disputeId_) external view returns (address);

  function claimChallenger(uint256 claimId_) external view returns (address);

  function addAgreementForProtocol(
    uint256 protocolId_,
    string calldata agreementIpfsHash_
  ) external;
}
