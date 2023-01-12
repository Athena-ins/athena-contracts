// SPDX-License-Identifier: MIT
/**
 *  @authors: [@epiqueras]
 *  @reviewers: [@remedcu]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity ^0.8;

import "./IArbitrator.sol";

/** @title IArbitrable
 *  @author Enrique Piqueras - <enrique@kleros.io>
 *  Arbitrable interface.
 *  When developing arbitrable contracts, we need to:
 *  -Define the action taken when a ruling is received by the contract. We should do so in executeRuling.
 *  -Allow dispute creation. For this a function must:
 *      -Call arbitrator.createDispute.value(_fee)(_choices,_extraData);
 *      -Create the event Dispute(_arbitrator,_disputeID,_rulingOptions);
 */
interface IArbitrable {
  /** @dev To be raised when a ruling is given.
   *  @param _arbitrator The arbitrator giving the ruling.
   *  @param _disputeID ID of the dispute in the IArbitrator contract.
   *  @param _ruling The ruling which was given.
   */
  event Ruling(
    IArbitrator indexed _arbitrator,
    uint256 indexed _disputeID,
    uint256 _ruling
  );

  /** @dev Give a ruling for a dispute. Must be called by the arbitrator.
   *  The purpose of this function is to ensure that the address calling it has the right to rule on the contract.
   *  @param _disputeID ID of the dispute in the IArbitrator contract.
   *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(uint256 _disputeID, uint256 _ruling) external;
}
