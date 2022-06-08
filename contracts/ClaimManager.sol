// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "hardhat/console.sol";

import "./interfaces/IArbitrator.sol";
import "./interfaces/IAthena.sol";

contract ClaimManager is IArbitrable {
  address payable private immutable core;
  IArbitrator public immutable arbitrator;
  uint256 public delay = 14 days;

  enum Status {
    Initial,
    Reclaimed,
    Disputed,
    Resolved
  }

  enum RulingOptions {
    RefusedToArbitrate,
    PayerWins,
    PayeeWins
  }

  struct Claim {
    address payable from;
    uint256 createdAt;
    uint256 disputeId;
    uint256 klerosId;
    uint256 policyId;
    uint256 arbitrationCost;
    uint256 amount;
    Status status;
    address payable challenger;
  }

  uint256 public disputesCounter;

  event ClaimCreated(
    address _claimant,
    uint256 _disputeId,
    uint256 _policyId,
    uint256 _amount
  );
  event Dispute(
    IArbitrator _arbitrator,
    uint256 _disputeId,
    uint256 _policyId,
    uint256 _amount
  );
  event Solved(IArbitrator _arbitrator, uint256 _disputeId, uint256 _policyId);

  mapping(uint256 => Claim) public claims;
  mapping(address => uint256[]) public ownerClaims;
  mapping(uint256 => uint256) private _klerosToDisputeId;

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  constructor(address _core, IArbitrator _arbitrator) {
    core = payable(_core);
    arbitrator = _arbitrator;
  }

  /**
   * @dev Give a ruling for a dispute. Must be called by the arbitrator.
   * The purpose of this function is to ensure that the address calling it has the right to rule on the contract.
   * @param _disputeId ID of the dispute in the Arbitrator contract.
   * @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
   */
  function rule(uint256 _disputeId, uint256 _ruling) external {
    require(msg.sender == address(arbitrator), "Only Arbitrator can rule");
    // Make action based on ruling
    Claim storage __dispute = claims[_klerosToDisputeId[_disputeId]];
    __dispute.status = Status.Resolved;
    // if accepted, send funds from Protocol to claimant
    uint256 __amount = 0;
    if (_ruling == 1) {
      __dispute.from.transfer(__dispute.amount);
      __amount = __dispute.amount;
    } else {
      __dispute.challenger.transfer(__dispute.amount);
    }
    // call Athena core for unlocking the funds
    IAthena(core).resolveClaim(__dispute.policyId, __amount, __dispute.from);
    emit Solved(arbitrator, __dispute.disputeId, _ruling);
    emit Ruling(arbitrator, __dispute.disputeId, _ruling);
  }

  function arbitrationCost() public view returns (uint256) {
    return arbitrator.arbitrationCost("");
  }

  function claim(
    address _account,
    uint256 _policyId,
    uint256 _amount
  ) external payable onlyCore {
    for (uint256 index = 0; index < ownerClaims[_account].length; index++) {
      if (claims[ownerClaims[_account][index]].policyId == _policyId) {
        require(
          block.timestamp >
            claims[ownerClaims[_account][index]].createdAt + delay,
          "Already claiming"
        );
      }
    }
    uint256 __arbitrationCost = arbitrationCost();
    require(msg.value >= __arbitrationCost, "Not enough ETH for claim");
    //@dev TODO : should lock the capital in protocol pool
    disputesCounter++;
    ownerClaims[_account].push(disputesCounter);
    claims[disputesCounter] = Claim({
      from: payable(_account),
      createdAt: block.timestamp,
      disputeId: disputesCounter,
      klerosId: 0,
      arbitrationCost: __arbitrationCost,
      policyId: _policyId,
      amount: _amount,
      status: Status.Initial,
      challenger: payable(0x00)
    });
    emit ClaimCreated(_account, disputesCounter, _policyId, _amount);
  }

  function challenge(uint256 _disputeId) external payable {
    require(claims[_disputeId].status == Status.Initial, "Dispute ongoing");
    require(
      block.timestamp < claims[_disputeId].createdAt + delay,
      "Challenge delay passed"
    );
    uint256 __arbitrationCost = arbitrationCost();
    require(msg.value >= __arbitrationCost, "Not enough ETH for challenge");
    uint256 __klerosId = arbitrator.createDispute{ value: msg.value }(2, "");
    claims[_disputeId].status = Status.Disputed;
    claims[_disputeId].klerosId = __klerosId;
    _klerosToDisputeId[__klerosId] = _disputeId;
    claims[_disputeId].challenger = payable(msg.sender);
    emit Dispute(arbitrator, __klerosId, _disputeId, _disputeId);
  }

  function remainingTimeToReclaim(uint256 _disputeId)
    public
    view
    returns (uint256)
  {
    require(claims[_disputeId].status == Status.Initial, "Status not initial");
    return
      (block.timestamp - claims[_disputeId].createdAt) > delay
        ? 0
        : (claims[_disputeId].createdAt + delay - block.timestamp);
  }

  // function resolve(uint256 _disputeId) external {
  //   require(claims[_disputeId].status == Status.Initial, "Dispute ongoing");
  //   require(
  //     block.timestamp > claims[_disputeId].createdAt + delay,
  //     "Delay is not over"
  //   );
  //   _resolve(_disputeId, 1);
  // }

  function releaseFunds(uint256 _disputeId) public {
    require(
      claims[_disputeId].status == Status.Initial,
      "Dispute is not in initial state"
    );
    require(
      block.timestamp - claims[_disputeId].createdAt > delay,
      "Delay is not over"
    );
    claims[_disputeId].status = Status.Resolved;
    claims[_disputeId].from.transfer(claims[_disputeId].amount);
    // call Athena core for release funds to claimant
    IAthena(core).resolveClaim(
      claims[_disputeId].policyId,
      claims[_disputeId].amount,
      claims[_disputeId].from
    );
  }
}
