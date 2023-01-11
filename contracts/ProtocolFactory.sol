// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "./ProtocolPool.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ProtocolFactory {
  address private immutable core;
  uint256 public immutable commitDelay;
  address public immutable policyManager;

  constructor(
    address _core,
    address policyManager_,
    uint256 _commitDelay
  ) {
    core = _core;
    policyManager = policyManager_;
    commitDelay = _commitDelay;
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function deployProtocol(
    address stablecoin,
    uint128 newPoolId,
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2
  ) external onlyCore returns (address) {
    return
      address(
        new ProtocolPool(
          core,
          policyManager,
          stablecoin,
          newPoolId,
          _uOptimal,
          _r0,
          _rSlope1,
          _rSlope2,
          commitDelay
        )
      );
  }
}
