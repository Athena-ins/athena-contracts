// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

interface IVPool {
  function getInfo(
    uint256 coverId
  )
    external
    view
    returns (
      uint256 premiumLeft,
      uint256 currentEmissionRate,
      uint256 remainingDay
    );
}
