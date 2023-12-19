// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IAthenaCore {
  // struct ProtocolView {
  //   string name;
  //   bool paused;
  //   uint128 claimsOngoing;
  //   uint128 poolId;
  //   address deployed;
  //   address token;
  //   uint256 insuredCapital;
  //   uint256 availableCapacity;
  //   uint256 utilizationRate;
  //   uint256 premiumRate;
  //   uint256 aaveLiquidityRate;
  //   IProtocolPool.Formula computingConfig;
  //   string claimAgreement;
  //   uint256 commitDelay;
  //   uint128[] incompatiblePools;
  // }

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
