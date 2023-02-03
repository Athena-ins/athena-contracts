// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IPolicyCover {
  event BuyPolicy(address owner, uint256 premium, uint256 capitalInsured);
  event WithdrawPolicy(uint256 coverId, uint256 remainedAmount);
  event ExpiredPolicy(uint256 coverId, uint32 tick);

  struct Slot0 {
    uint32 tick;
    uint256 secondsPerTick;
    uint256 totalInsuredCapital;
    uint256 remainingPolicies;
    uint256 lastUpdateTimestamp;
  }

  struct Formula {
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  function getInfo(uint256 coverId)
    external
    view
    returns (
      uint256 premiumLeft,
      uint256 currentEmissionRate,
      uint256 remainingDay
    );
}
