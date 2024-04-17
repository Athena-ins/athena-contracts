// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IOwnable {
  function owner() external view returns (address);

  function transferOwnership(address newOwner) external;

  function renounceOwnership() external;
}
