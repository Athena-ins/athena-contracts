// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "hardhat/console.sol";

import "./interfaces/IArbitrator.sol";

contract ClaimManager is IArbitrable {
  address private immutable core;
  IArbitrator public immutable arbitrator;

  struct Claim {
    address from;
    uint256 createdAt;
    uint256 disputeId;
    uint256 policyId;
    uint256 amount;
  }

  mapping(address => Claim[]) private claims;

  constructor(address _core, IArbitrator _arbitrator) {
    core = _core;
    arbitrator = _arbitrator;
  }

  /**
   * @dev Give a ruling for a dispute. Must be called by the arbitrator.
   * The purpose of this function is to ensure that the address calling it has the right to rule on the contract.
   * @param _disputeID ID of the dispute in the Arbitrator contract.
   * @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(uint256 _disputeID, uint256 _ruling) external {
    require(msg.sender == address(arbitrator), "Only Arbitrator can rule");
    // Make action based on ruling
    emit Ruling(arbitrator, _disputeID, _ruling);
  }

  function claim(address _account, uint256 _policyId, uint256 _amount) external {
    Claim[] memory accountClaims = claims[_account];
    for (uint256 index = 0; index < accountClaims.length; index++) {
      if(accountClaims[index].policyId == _policyId) {
        require(accountClaims[index].createdAt > block.timestamp + 14 days,  "Already claiming");
      }
    }
  }

  function challenge() external {

  }

  function resolve() external {

  }
}
