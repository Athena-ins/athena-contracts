// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IProtocolFactory {
  function deployProtocol(
    string calldata name,
    address rewardsToken,
    uint128 newProtocolId
  ) external returns (address _protocolDeployed);
}
