// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import "./interfaces/IPolicyManager.sol";
import "./interfaces/IAthena.sol";
import "./interfaces/IProtocolPool.sol";

contract PolicyManager is IPolicyManager, ERC721Enumerable {
  address private core;

  /// @dev The token ID policy data
  mapping(uint256 => Policy) public policies;

  mapping(address => ExpiredPolicy[]) public expiredPolicies;

  /// @dev The ID of the next token that will be minted.
  uint176 private nextId = 0;

  constructor(address coreAddress)
    ERC721("ATHENA-Policy", "Athena Insurance Policy")
  {
    core = coreAddress;
  }

  /// =========================== ///
  /// ========= MODIFIER ======== ///
  /// =========================== ///

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function policyActive(uint256 _tokenId) external view returns (bool) {
    return policies[_tokenId].amountCovered != 0;
  }

  function poolIdOfPolicy(uint256 _tokenId) external view returns (uint128) {
    return policies[_tokenId].poolId;
  }

  function policy(uint256 _tokenId)
    public
    view
    override
    returns (Policy memory)
  {
    return policies[_tokenId];
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

  function allPolicyTokensOfOwner(address owner)
    public
    view
    returns (uint256[] memory tokenList)
  {
    uint256 tokenLength = balanceOf(owner);
    tokenList = new uint256[](tokenLength);
    for (uint256 i = 0; i < tokenLength; i++)
      tokenList[i] = tokenOfOwnerByIndex(owner, i);
  }

  function allPoliciesOfOwner(address owner)
    external
    view
    returns (Policy[] memory policyList)
  {
    uint256[] memory tokenList = allPolicyTokensOfOwner(owner);
    policyList = new Policy[](tokenList.length);
    for (uint256 i = 0; i < tokenList.length; i++)
      policyList[i] = policies[tokenList[i]];
  }

  function getExpiredPolicies(address account)
    public
    view
    returns (ExpiredPolicy[] memory)
  {
    return expiredPolicies[account];
  }

  function getOngoingCoveragePolicies(address account)
    public
    view
    returns (OngoingCoveragePolicy[] memory ongoingCoverages)
  {
    uint256[] memory _tokens = allPolicyTokensOfOwner(account);
    ongoingCoverages = new OngoingCoveragePolicy[](_tokens.length);
    for (uint256 i = 0; i < _tokens.length; i++) {
      Policy memory _policy = policy(_tokens[i]);
      address protocolAddress = IAthena(core).getProtocolAddressById(
        _policy.poolId
      );
      (
        uint256 _premiumLeft,
        uint256 _dailyCost,
        uint256 _estDuration
      ) = IProtocolPool(protocolAddress).getInfo(account);

      ongoingCoverages[i] = OngoingCoveragePolicy({
        policyId: _tokens[i],
        amountCovered: _policy.amountCovered,
        premiumDeposit: _policy.premiumDeposit,
        premiumLeft: _premiumLeft,
        atensLocked: _policy.atensLocked,
        dailyCost: _dailyCost,
        beginCoveredTime: _policy.beginCoveredTime,
        remainingDuration: _estDuration,
        poolId: _policy.poolId
      });
    }
  }

  /// ========================= ///
  /// ========= CREATE ======== ///
  /// ========================= ///

  function mint(
    address _to,
    uint256 _amountCovered,
    uint256 _premiumDeposit,
    uint256 _atensLocked,
    uint128 _poolId
  ) external override onlyCore returns (uint256) {
    policies[nextId] = Policy({
      poolId: _poolId,
      amountCovered: _amountCovered,
      premiumDeposit: _premiumDeposit,
      atensLocked: _atensLocked,
      beginCoveredTime: block.timestamp
    });

    _mint(_to, nextId);
    nextId++;

    return nextId - 1;
  }

  /// ======================== ///
  /// ========= CLOSE ======== ///
  /// ======================== ///

  function burn(uint256 tokenId) public override onlyCore {
    _burn(tokenId);
    delete policies[tokenId];
  }

  function saveExpiredPolicy(
    address _owner,
    uint256 _policyId,
    Policy memory _policy,
    uint256 _premiumSpent,
    bool _isCanceled
  ) public override onlyCore {
    // @bw should only save token id of expired or set to expired state
    expiredPolicies[_owner].push(
      ExpiredPolicy({
        policyId: _policyId,
        amountCovered: _policy.amountCovered,
        premiumDeposit: _policy.premiumDeposit,
        premiumSpent: _premiumSpent,
        atensLocked: _policy.atensLocked,
        beginCoveredTime: _policy.beginCoveredTime,
        endCoveredTime: block.timestamp, // @bw ce n'est pas bon
        poolId: _policy.poolId,
        isCancelled: _isCanceled
      })
    );
  }

  //Thao@TODO: cette fct doit retourner capitalToRemove
  function processExpiredTokens(uint256[] calldata _expiredTokens)
    external
    override
    onlyCore
  {
    for (uint256 i = 0; i < _expiredTokens.length; i++) {
      IPolicyManager.Policy memory policy_ = policy(_expiredTokens[i]);

      saveExpiredPolicy(
        ownerOf(_expiredTokens[i]),
        _expiredTokens[i],
        policy_,
        policy_.premiumDeposit,
        false
      );

      burn(_expiredTokens[i]);
    }
  }
}
