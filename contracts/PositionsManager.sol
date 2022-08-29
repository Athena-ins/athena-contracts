// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/IPositionsManager.sol";
import "./libraries/PositionsLibrary.sol";

contract PositionsManager is IPositionsManager, ERC721Enumerable {
  struct Position {
    address owner;
    uint256 providedLiquidity;
    uint256 createdAt;
    //AAVE AToken to redeem
    uint256 atokenBalance;
    //Aten to stake with position in stable
    uint256 atens;
    uint128 discount;
    // alternative would be mapping id to protocol data
    // like amount for Protocol, ...
    uint128[] protocolsId;
  }

  address private core;

  /// @dev The token ID position data
  mapping(uint256 => Position) private _positions;

  /// @dev The ID of the next token that will be minted.
  uint176 private _nextId = 0;

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  constructor(address coreAddress) ERC721("ATHENA", "athena-co.io") {
    core = coreAddress;
  }

  // function burn(uint256 tokenId, uint256 amount) external {
  //     Position storage position = _positions[tokenId];
  //     require(position.providedLiquidity == 0, "Not cleared");
  //     delete _positions[tokenId];
  //     _burn(msg.sender, tokenId, amount);
  // }

  function positions(uint256 _tokenId)
    external
    view
    override
    returns (
      uint256 liquidity,
      uint128[] memory protocolsId,
      uint256 atokens,
      uint128 discount,
      uint256 createdAt
    )
  {
    Position memory position = _positions[_tokenId];
    return (
      position.providedLiquidity,
      position.protocolsId,
      position.atokenBalance,
      position.discount,
      position.createdAt
    );
  }

  function mint(
    address to,
    uint128 _discount,
    uint256 amount,
    uint256 _atokenBalance,
    uint256 atenStake,
    uint128[] calldata _protocolsIds
  ) external override onlyCore {
    _positions[_nextId] = Position({
      owner: to,
      providedLiquidity: amount,
      atokenBalance: _atokenBalance,
      createdAt: block.timestamp,
      discount: _discount,
      protocolsId: _protocolsIds,
      atens: atenStake
    });
    _mint(to, _nextId);
    _nextId++;
  }

  function burn(address to) external override onlyCore {
    uint256 tokenId = tokenOfOwnerByIndex(to, 0);
    _burn(tokenId);
  }

  function update(
    uint128 _discount,
    uint256 amount,
    uint256 _atokenBalance,
    uint256 atenStake,
    uint128[] calldata _protocolsIds,
    uint256 tokenId
  ) external override onlyCore {
    _positions[tokenId].providedLiquidity = amount;
    if (_atokenBalance != 0) {
      _positions[tokenId].atokenBalance = _atokenBalance;
    }
    _positions[tokenId].discount = _discount;
    _positions[tokenId].protocolsId = _protocolsIds;
    _positions[tokenId].atens = atenStake;
  }

  function updateUserCapital(uint256 tokenId, uint256 _amount)
    external
    override
    onlyCore
  {
    _positions[tokenId].providedLiquidity = _amount;
  }

  // function _safeMint() internal {

  // }
}
