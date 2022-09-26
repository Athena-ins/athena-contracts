// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/IPolicyManager.sol";

contract PolicyManager is IPolicyManager, ERC721Enumerable {
  address private core;

  /// @dev The token ID policy data
  mapping(uint256 => Policy) public policies;

  mapping(address => ExpiredPolicy[]) public expiredPolicies;

  /// @dev The ID of the next token that will be minted.
  uint176 private nextId = 0;

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  constructor(address coreAddress) ERC721("ATHENA_Policy", "athena-co.io") {
    core = coreAddress;
  }

  function policy(uint256 _tokenId)
    public
    view
    override
    returns (Policy memory)
  {
    return policies[_tokenId];
  }

  function mint(
    address _to,
    uint256 _amountCovered,
    uint256 _paidPremium,
    uint256 _atensLocked,
    uint128 _protocolId
  ) external override onlyCore returns (uint256) {
    policies[nextId] = Policy({
      protocolId: _protocolId,
      amountCovered: _amountCovered,
      paidPremium: _paidPremium,
      atensLocked: _atensLocked,
      beginCoveredTime: block.timestamp
    });

    _mint(_to, nextId);
    nextId++;

    return nextId - 1;
  }

  function burn(uint256 tokenId) public onlyCore {
    _burn(tokenId);
    delete policies[tokenId];
  }

  function saveExpiredPolicy(
    address _owner,
    Policy memory _policy,
    uint256 _actualFees,
    bool _isCanceled
  ) public override onlyCore {
    expiredPolicies[_owner].push(
      ExpiredPolicy({
        amountCovered: _policy.amountCovered,
        paidPremium: _policy.paidPremium,
        actualFees: _actualFees,
        atensLocked: _policy.atensLocked,
        beginCoveredTime: _policy.beginCoveredTime,
        endCoveredTime: block.timestamp, //ce n'est pas bon
        protocolId: _policy.protocolId,
        isCanceled: _isCanceled
      })
    );
  }

  function checkAndGetPolicy(
    address account,
    uint256 policyId,
    uint256 index
  ) external view override returns (Policy memory) {
    require(account == ownerOf(policyId), "Policy is not owned");
    require(
      policyId == tokenOfOwnerByIndex(account, index),
      "Wrong Token Id for Policy"
    );

    return policy(policyId);
  }

  //Thao@TODO: cette fct doit retourner capitalToRemove
  function processExpiredTokens(uint256[] calldata _expiredTokens)
    external
    onlyCore
  {
    for (uint256 i = 0; i < _expiredTokens.length; i++) {
      IPolicyManager.Policy memory policy_ = policy(_expiredTokens[i]);

      saveExpiredPolicy(
        ownerOf(_expiredTokens[i]),
        policy_,
        policy_.paidPremium,
        false
      );

      burn(_expiredTokens[i]);
    }
  }

  function getExpiredPolicies(address account)
    public
    view
    returns (ExpiredPolicy[] memory)
  {
    return expiredPolicies[account];
  }
}
