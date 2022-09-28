// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IAthena.sol";
import "./interfaces/IProtocolPool.sol";

contract AthenaView {
  struct ProtocolView {
    string symbol;
    string name;
    uint128 protocolId;
    uint256 totalCouvrageValue;
    uint256 availableCapacity;
    uint256 utilizationRate;
    uint256 premiumRate;
  }

  address public immutable core;

  constructor(address _core) {
    core = _core;
  }

  function linearProtocolsView(uint128 beginId, uint256 numberOfProtocols)
    external
    view
    returns (ProtocolView[] memory protocolsInfo)
  {
    uint256 nextProtocolId_ = IAthena(core).getNextProtocolId();
    require(beginId < nextProtocolId_, "begin Id is not exist");

    uint256 __numberOfProtocols = nextProtocolId_ - beginId >= numberOfProtocols
      ? numberOfProtocols
      : nextProtocolId_ - beginId;

    protocolsInfo = new ProtocolView[](__numberOfProtocols);
    for (uint128 i = 0; i < __numberOfProtocols; i++) {
      (
        string memory symbol,
        string memory name,
        uint256 totalCouvrageValue,
        uint256 availableCapacity,
        uint256 utilizationRate,
        uint256 premiumRate
      ) = IProtocolPool(IAthena(core).getPoolAddressById(beginId + i))
          .protocolInfo();

      protocolsInfo[i] = ProtocolView(
        symbol,
        name,
        beginId + i,
        totalCouvrageValue,
        availableCapacity,
        utilizationRate,
        premiumRate
      );
    }
  }

  function protocolsView(uint128[] calldata protocolsId)
    external
    view
    returns (ProtocolView[] memory protocolsInfo)
  {
    protocolsInfo = new ProtocolView[](protocolsId.length);
    for (uint128 i = 0; i < protocolsId.length; i++) {
      (
        string memory symbol,
        string memory name,
        uint256 totalCouvrageValue,
        uint256 availableCapacity,
        uint256 utilizationRate,
        uint256 premiumRate
      ) = IProtocolPool(IAthena(core).getPoolAddressById(protocolsId[i]))
          .protocolInfo();

      protocolsInfo[i] = ProtocolView(
        symbol,
        name,
        protocolsId[i],
        totalCouvrageValue,
        availableCapacity,
        utilizationRate,
        premiumRate
      );
    }
  }
}
