// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/IPolicyManager.sol";

contract PolicyManager is IPolicyManager, ERC721Enumerable {
  struct Policy {
    uint256 amountGuaranteed; //Thao@NOTE: cette variable est 'capitalInsured' de PremiumPosition.Info.capitalInsured. Nous pouvons garder ici pour flash info mais il faut enlever pour save gas.
    uint256 atensLocked; //Aten to stake with policy in stable
    uint128 protocolId;
  }

  address private core;

  /// @dev The token ID policy data
  mapping(uint256 => Policy) public _policies;

  /// @dev The ID of the next token that will be minted.
  uint176 private _nextId = 0;

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  constructor(address coreAddress) ERC721("ATHENA_Policy", "athena-co.io") {
    core = coreAddress;
  }

  // function burn(uint256 tokenId, uint256 amount) external {
  //     Position storage position = _policies[tokenId];
  //     require(position.providedLiquidity == 0, "Not cleared");
  //     delete _policies[tokenId];
  //     _burn(msg.sender, tokenId, amount);
  // }

  function policies(uint256 _tokenId)
    external
    view
    override
    returns (uint256 liquidity, uint128 protocolId)
  {
    Policy memory policy = _policies[_tokenId];
    return (policy.amountGuaranteed, policy.protocolId);
  }

  function mint(
    address to,
    uint256 capitalGuaranteed,
    uint256 atensLocked,
    uint128 _protocolId
  ) external override onlyCore {
    _policies[_nextId] = Policy({
      amountGuaranteed: capitalGuaranteed,
      protocolId: _protocolId,
      atensLocked: atensLocked
    });
    _mint(to, _nextId);
    _nextId++;
  }

  function update(
    uint128 _discount,
    uint256 amount,
    uint256 atenStake,
    uint128 _protocolId,
    uint256 tokenId
  ) external override onlyCore {
    _policies[tokenId] = Policy({
      amountGuaranteed: amount,
      protocolId: _protocolId,
      atensLocked: atenStake
    });
  }
}
