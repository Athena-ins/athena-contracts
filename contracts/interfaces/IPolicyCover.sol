// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IPolicyCover {
  //Thao@TODO: add event expiredPolicy
  //Thao@TODO: move view fcts into another contract

  event Actualizing(
    uint24 tick,
    uint256 premiumRate,
    uint256 secondsPerTick,
    uint256 remainingPolicies,
    uint256 liquidityIndex,
    uint256 lastUpdateTimestamp
  );
  event BuyPolicy(address owner, uint256 premium, uint256 capitalInsured);
  event WithdrawPolicy(address owner, uint256 remainedAmount);

  struct Slot0 {
    uint24 tick;
    uint256 premiumRate; //Ray //cai nay chi can tinh chu ko can luu
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

  function actualizingUntilGivenDate(uint256 dateInSecond)
    external
    view
    returns (Slot0 memory slot0, uint256 liquidityIndex);

  function getInfo(address owner)
    external
    view
    returns (uint256 remainingPremium, uint256 remainingDay);
}
