// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IPolicyCover {
  //Thao@TODO: add event expiredPolicy
  //Thao@TODO: move view fcts into another contract

  event Actualizing(
    uint24 tick,
    uint256 useRate,
    uint256 emissionRate,
    uint256 hoursPerTick,
    uint256 availableCapital,
    uint256 premiumSpent,
    uint256 remainingPolicies,
    uint256 lastUpdateTimestamp
  );
  event BuyPolicy(address owner, uint256 premium, uint256 capitalInsured);
  event WithdrawPolicy(address owner, uint256 remainedAmount);

  struct Slot0 {
    uint24 tick;
    uint256 premiumRate; //RAY
    uint256 emissionRate; //RAY
    uint256 hoursPerTick; //RAY
    uint256 totalInsuredCapital; //RAY
    uint256 premiumSpent; //RAY
    uint256 remainingPolicies;
    uint256 lastUpdateTimestamp;
  }

  struct Formula {
    uint256 uOptimal;
    uint256 r0;
    uint256 rSlope1;
    uint256 rSlope2;
  }

  function actualizingUntilGivenDate(uint256 dateInSecond)
    external
    view
    returns (Slot0 memory slot0, uint256 availableCapital);

  function getInfo(address owner)
    external
    view
    returns (uint256 remainingPremium, uint256 remainingDay);
}
