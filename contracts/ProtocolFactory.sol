// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "./ProtocolPool.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ProtocolFactory {
  address private immutable core;
  uint256 public immutable commitDelay;

  constructor(address _core, uint256 _commitDelay) {
    core = _core;
    commitDelay = _commitDelay;
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function deployProtocol(
    string calldata name,
    address stablecoin,
    uint128 newProtocolId,
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2
  ) external onlyCore returns (address) {
    return
      address(
        new ProtocolPool(
          core,
          stablecoin,
          newProtocolId,
          _uOptimal,
          _r0,
          _rSlope1,
          _rSlope2,
          name,
          commitDelay
        )
      );
  }
}
