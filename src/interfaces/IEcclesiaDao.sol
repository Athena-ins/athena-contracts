// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IEcclesiaDao {
  function accrueRevenue(
    address _token,
    uint256 _amount,
    uint256 leverageFee_
  ) external;
}
