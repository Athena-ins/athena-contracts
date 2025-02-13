// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

interface IKlerosLiquid {
  enum Phase {
    staking, // Stake sum trees can be updated
    generating, // Waiting for random number
    drawing // Jurors can be drawn
  }

  enum Period {
    evidence, // Evidence can be submitted. Drawing occurs here
    commit, // Jurors commit votes (for hidden vote courts)
    vote, // Jurors reveal/cast votes
    appeal, // Dispute can be appealed
    execution // Tokens redistributed and ruling executed
  }

  enum DisputeStatus {
    Waiting, // Dispute is waiting for jurors
    Appealable, // Dispute can be appealed
    Solved // Dispute has been resolved
  }

  // Core functions
  function createDispute(
    uint _numberOfChoices,
    bytes calldata _extraData
  ) external payable returns (uint disputeID);

  function appeal(
    uint _disputeID,
    bytes calldata _extraData
  ) external payable;

  function executeRuling(uint _disputeID) external;

  function passPeriod(uint _disputeID) external;

  function passPhase() external;

  function drawJurors(uint _disputeID, uint _iterations) external;

  // View functions
  function disputes(
    uint _disputeID
  )
    external
    view
    returns (
      uint96 subcourtID,
      address arbitrated,
      uint numberOfChoices,
      Period period,
      uint lastPeriodChange,
      uint drawsInRound,
      uint commitsInRound,
      bool ruled
    );

  function phase() external view returns (Phase);

  function disputeStatus(
    uint _disputeID
  ) external view returns (DisputeStatus status);

  function currentRuling(
    uint _disputeID
  ) external view returns (uint ruling);

  function arbitrationCost(
    bytes calldata _extraData
  ) external view returns (uint cost);

  function appealCost(
    uint _disputeID,
    bytes calldata _extraData
  ) external view returns (uint cost);

  function appealPeriod(
    uint _disputeID
  ) external view returns (uint start, uint end);

  // Events
  event DisputeCreation(
    uint indexed _disputeID,
    address indexed _arbitrable
  );
  event AppealPossible(
    uint indexed _disputeID,
    address indexed _arbitrable
  );
  event AppealDecision(
    uint indexed _disputeID,
    address indexed _arbitrable
  );
}
