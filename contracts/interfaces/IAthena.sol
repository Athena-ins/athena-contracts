// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./IProtocolPool.sol";

interface IAthena {
  struct ProtocolView {
    string name;
    bool paused;
    uint128 claimsOngoing;
    uint128 poolId;
    address deployed;
    address stablecoin;
    uint256 insuredCapital;
    uint256 availableCapacity;
    uint256 utilizationRate;
    uint256 premiumRate;
    IProtocolPool.Formula computingConfig;
    string claimAgreement;
    uint256 commitDelay;
  }

  function coverManager() external view returns (address);

  function actualizingProtocolAndRemoveExpiredPolicies(
    address protocolAddress
  ) external;

  function actualizingProtocolAndRemoveExpiredPoliciesByPoolId(
    uint128 poolId
  ) external;

  function compensateClaimant(
    uint256 coverId,
    uint256 amount,
    address account
  ) external;

  function stakeAtens(uint256 amount) external;
}
