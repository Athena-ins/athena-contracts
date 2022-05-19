// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "./ProtocolPool.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ProtocolFactory {
  address private immutable core;

  constructor(address _core) {
    core = _core;
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function deployProtocol(
    string calldata name,
    address stablecoin,
    uint128 newProtocolId
  ) external onlyCore returns (address _protocolDeployed) {
    ProtocolPool protocolDeployed = new ProtocolPool(
      core,
      stablecoin,
      name,
      // A P P = Athena Protocol Pool
      string(abi.encodePacked("APP_", Strings.toString(newProtocolId)))
    );
    _protocolDeployed = address(protocolDeployed);
  }
}
