// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "hardhat/console.sol";

import "./interfaces/IArbitrator.sol";

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
    address from;
    uint256 createdAt;
    uint256 disputeId;
    uint256 policyId;
    uint256 amount;
    Status status;
  }

  uint256 public disputesCounter;

  event ClaimCreated(
    address _claimant,
    uint256 _disputeId,
    uint256 _policyId,
    uint256 _amount
  );
  event Challenged(address _challenger, uint256 _disputeId);

  mapping(uint256 => Claim) private claims;
  mapping(address => uint256[]) private ownerClaims;

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
    _resolve(_disputeId, _ruling);
    if (_ruling == uint256(RulingOptions.PayerWins))
      core.send(address(this).balance);
    else if (_ruling == uint256(RulingOptions.PayeeWins))
      core.send(address(this).balance);
    emit Ruling(arbitrator, _disputeId, _ruling);
  }

  function arbitrationCost() public view returns (uint256) {
    return arbitrator.arbitrationCost("");
  }

  function claim(
    address _account,
    uint256 _policyId,
    uint256 _amount
  ) external payable {
    for (uint256 index = 0; index < ownerClaims[_account].length; index++) {
      if (claims[ownerClaims[_account][index]].policyId == _policyId) {
        require(
          block.timestamp >
            claims[ownerClaims[_account][index]].createdAt + delay,
          "Already claiming"
        );
      }
    }
    require(msg.value >= arbitrator.arbitrationCost(""), "Not enough ETH for claim");
    //@dev TODO : should lock the capital in protocol pool
    disputesCounter++;
    ownerClaims[_account].push(disputesCounter);
    claims[disputesCounter] = Claim(
      msg.sender,
      block.timestamp,
      disputesCounter,
      _policyId,
      _amount,
      Status.Initial
    );
    emit ClaimCreated(_account, disputesCounter, _policyId, _amount);
  }

  function challenge(uint256 _disputeId) external payable {
    require(claims[_disputeId].status == Status.Initial, "Dispute ongoing");
    require(
      block.timestamp > claims[_disputeId].createdAt + delay,
      "Challenge delay passed"
    );
    arbitrator.createDispute{ value: msg.value }(2, "");
    claims[_disputeId].status = Status.Disputed;
    emit Challenged(msg.sender, _disputeId);
  }

  function remainingTimeToReclaim(uint256 _disputeId)
    public
    view
    returns (uint256)
  {
    require(claims[_disputeId].status != Status.Initial, "Status not initial");
    return
      (block.timestamp - claims[_disputeId].createdAt) > delay
        ? 0
        : (claims[_disputeId].createdAt + delay - block.timestamp);
  }

  function resolve(uint256 _disputeId) external {
    require(claims[_disputeId].status == Status.Initial, "Dispute ongoing");
    require(
      block.timestamp > claims[_disputeId].createdAt + delay,
      "Delay is not over"
    );
    _resolve(_disputeId, 1);
  }

  function _resolve(uint256 _disputeId, uint256 _ruling) internal {
    //@dev TODO : should unlock the capital in protocol pool
    claims[_disputeId].status = Status.Resolved;
  }
}
