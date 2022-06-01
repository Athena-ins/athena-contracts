// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IProtocolFactory {
  function deployProtocol(
    string calldata name,
    address stablecoin,
    uint128 newProtocolId,
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2
  ) external returns (address _protocolDeployed);
}
