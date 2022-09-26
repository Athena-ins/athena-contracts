// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/IPolicyManager.sol";

contract PolicyManager is IPolicyManager, ERC721Enumerable {
  struct Policy {
    uint128 protocolId;
    uint256 amountCovered;
    uint256 paidPremium;
    uint256 atensLocked;
    uint256 beginCoveredTime;
  }

  address private core;

  /// @dev The token ID policy data
  mapping(uint256 => Policy) public policies;

  /// @dev The ID of the next token that will be minted.
  uint176 private nextId = 0;

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  constructor(address coreAddress) ERC721("ATHENA_Policy", "athena-co.io") {
    core = coreAddress;
  }

  //Thao@TODO: returns a policy, not 2 fields
  function policy(uint256 _tokenId)
    public
    view
    override
    returns (uint256 amountCovered, uint128 protocolId)
  {
    Policy memory _policy = policies[_tokenId];
    return (_policy.amountCovered, _policy.protocolId);
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

  function burn(uint256 tokenId) external {
    _burn(tokenId);
    delete policies[tokenId];
  }

  function checkAndGetPolicy(
    address account,
    uint256 policyId,
    uint256 index
  ) external view override returns (uint256 amountCovered, uint128 protocolId) {
    require(account == ownerOf(policyId), "Policy is not owned");
    require(
      policyId == tokenOfOwnerByIndex(account, index),
      "Wrong Token Id for Policy"
    );

    return policy(policyId);
  }
}
