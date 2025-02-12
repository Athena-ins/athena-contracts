// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "./IERC20.sol";

interface IStETH is IERC20 {
  function submit(
    address _referral
  ) external payable returns (uint256);

  function getSharesByPooledEth(
    uint256 _ethAmount
  ) external view returns (uint256);
}
