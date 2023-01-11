// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IAthena {
  struct Protocol {
    uint128 id; //id in mapping
    uint128 claimsOngoing; // claim ongoing, lock funds when claim is ongoing
    address deployed; //Protocol Pool Address deployed
    address protocolAddress; //address for the protocol interface to be unique
    uint8 premiumRate; //Premium rate to pay for this protocol
    uint8 guarantee; //Protocol guarantee type, could be 0 = smart contract vuln, 1 = unpeg, 2 = rug pull ...
    bool active; //is Active or paused
    string name; //Protocol name
  }

  function getProtocolAddressById(uint128 poolId)
    external
    view
    returns (address);

  function getFeeRateWithAten(uint256 atens) external view returns (uint128);

  function nextPoolId() external view returns (uint128);

  function actualizingProtocolAndRemoveExpiredPolicies(address protocolAddress)
    external;

  function actualizingProtocolAndRemoveExpiredPoliciesByPoolId(uint128 poolId)
    external;

  function compensateClaimant(
    uint256 policyId,
    uint256 amount,
    address account
  ) external;

  function stakeAtens(uint256 amount) external;
}
