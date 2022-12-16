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

  function policyManager() external view returns (address);

  function getProtocolAddressById(uint128 protocolId)
    external
    view
    returns (address);

  function getFeeRateWithAten(uint256 atens) external view returns (uint128);

  function nextProtocolId() external view returns (uint128);

  function transferLiquidityToAAVE(uint256 amount) external returns (uint256);

  function actualizingProtocolAndRemoveExpiredPolicies(address protocolAddress)
    external;

  function resolveClaim(
    uint256 _policyId,
    uint256 _amount,
    address _account
  ) external;

  function stakeAtens(uint256 amount) external;
}
