// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IPositionsManager.sol";
import "./libraries/PositionsLibrary.sol";

contract PositionsManager is IPositionsManager {
  struct Position {
    address owner;
    uint256 providedLiquidity;
    //AAVE scaled balance to redeem
    uint256 aaveScaledBalance;
    //Aten to stake with position in stable
    uint256 atens;
    uint128 discount;
    // alternative would be mapping id to protocol data
    // like amount for Protocol, ...
    uint128[] protocolsId;
  }

  address private core;

  mapping(address => Position) private _positions;

  modifier onlyCore() {
    require(msg.sender == core, "Only core");
    _;
  }

  constructor(address coreAddress) {
    core = coreAddress;
  }

  function positions(address _owner)
    external
    view
    override
    returns (
      uint256 liquidity,
      uint128[] memory protocolsId,
      uint256 aaveScaledBalance,
      uint128 discount
    )
  {
    Position memory position = _positions[_owner];
    return (
      position.providedLiquidity,
      position.protocolsId,
      position.aaveScaledBalance,
      position.discount
    );
  }

  function createPosition(
    address to,
    uint128 _discount,
    uint256 amount,
    uint256 _aaveScaledBalance,
    uint256 atenStake,
    uint128[] calldata _protocolsIds
  ) external override onlyCore {
    _positions[to] = Position({
      owner: to,
      providedLiquidity: amount,
      aaveScaledBalance: _aaveScaledBalance,
      discount: _discount,
      protocolsId: _protocolsIds,
      atens: atenStake
    });
  }

  function removePosition(address to) external override onlyCore {
    delete _positions[to];
  }

  function update(
    address to,
    uint128 _discount,
    uint256 amount,
    uint256 _aaveScaledBalance,
    uint256 atenStake,
    uint128[] calldata _protocolsIds
  ) external override onlyCore {
    _positions[to].providedLiquidity = amount;
    if (_aaveScaledBalance != 0) {
      _positions[to].aaveScaledBalance = _aaveScaledBalance;
    }
    _positions[to].discount = _discount;
    _positions[to].protocolsId = _protocolsIds;
    _positions[to].atens = atenStake;
  }

  function updateUserCapital(
    address to,
    uint256 _amount,
    uint256 _aaveScaledBalanceToRemove
  ) external override onlyCore {
    _positions[to].providedLiquidity = _amount;
    _positions[to].aaveScaledBalance -= _aaveScaledBalanceToRemove;
  }

  function removeProtocolId(address to, uint128 _protocolId)
    external
    override
    onlyCore
  {
    uint128[] memory __protocolsId = _positions[to].protocolsId;

    for (uint256 i = 0; i < __protocolsId.length; i++) {
      if (__protocolsId[i] == _protocolId) {
        __protocolsId[i] = __protocolsId[__protocolsId.length - 1];
        delete __protocolsId[__protocolsId.length - 1];
        break;
      }
    }

    _positions[to].protocolsId = __protocolsId;
  }

  function hasPositionOf(address to) external view override returns (bool) {
    return _positions[to].protocolsId.length > 0;
  }
}
