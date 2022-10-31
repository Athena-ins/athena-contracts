// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import "./interfaces/IAthena.sol";
import "./interfaces/IProtocolPool.sol";
import "./interfaces/IPositionsManager.sol";

import "./libraries/PositionsLibrary.sol";

contract PositionsManager is IPositionsManager, ERC721Enumerable {
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

  function position(uint256 tokenId)
    external
    view
    override
    returns (Position memory)
  {
    return _positions[tokenId];
  }

  function allPositionTokensOfOwner(address owner)
    public
    view
    returns (uint256[] memory tokenList)
  {
    uint256 tokenLength = balanceOf(owner);
    tokenList = new uint256[](tokenLength);
    for (uint256 index = 0; index < tokenLength; index++)
      tokenList[index] = tokenOfOwnerByIndex(owner, index);
  }

  function allPositionsOfOwner(address owner)
    external
    view
    returns (PositionInfo[] memory positionList)
  {
    uint256[] memory tokenList = allPositionTokensOfOwner(owner);
    positionList = new PositionInfo[](tokenList.length);
    for (uint256 index = 0; index < tokenList.length; index++) {
      Position storage __position = _positions[tokenList[index]];

      uint256 totalRewards;
      for (uint256 i = 0; i < __position.protocolIds.length; i++) {
        address poolAddress = IAthena(core).getProtocolAddressById(
          __position.protocolIds[i]
        );
        (, uint256 __totalRewards, ) = IProtocolPool(poolAddress).rewardsOf(
          owner,
          __position.amountSupplied,
          __position.protocolIds,
          __position.discount,
          block.timestamp
        );

        totalRewards += __totalRewards;
      }

      positionList[index] = PositionInfo({
        positionId: tokenList[index],
        premiumReceived: totalRewards,
        position: __position
      });
    }
  }

  function mint(
    address to,
    uint128 _discount,
    uint256 amount,
    uint256 _aaveScaledBalance,
    uint256 atenStake,
    uint128[] calldata _protocolIds
  ) external override onlyCore {
    _positions[_nextId] = Position({
      createdAt: block.timestamp,
      owner: to,
      amountSupplied: amount,
      aaveScaledBalance: _aaveScaledBalance,
      discount: _discount,
      protocolIds: _protocolIds,
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
    uint256 tokenId,
    uint256 amount,
    uint256 _aaveScaledBalance,
    uint256 atenStake,
    uint128 _discount,
    uint128[] calldata _protocolIds
  ) external override onlyCore {
    _positions[tokenId].amountSupplied = amount;
    _positions[tokenId].aaveScaledBalance = _aaveScaledBalance;
    _positions[tokenId].atens = atenStake;
    _positions[tokenId].discount = _discount;
    _positions[tokenId].protocolIds = _protocolIds;
  }

  function updateUserCapital(
    uint256 tokenId,
    uint256 _amount,
    uint256 _aaveScaledBalanceToRemove
  ) external override onlyCore {
    _positions[tokenId].amountSupplied = _amount;
    _positions[tokenId].aaveScaledBalance -= _aaveScaledBalanceToRemove;
  }

  function removeProtocolId(uint256 tokenId, uint128 _protocolId)
    external
    override
    onlyCore
  {
    uint128[] memory __protocolIds = _positions[tokenId].protocolIds;

    for (uint256 i = 0; i < __protocolIds.length; i++) {
      if (__protocolIds[i] == _protocolId) {
        __protocolIds[i] = __protocolIds[__protocolIds.length - 1];
        delete __protocolIds[__protocolIds.length - 1];
        break;
      }
    }

    _positions[tokenId].protocolIds = __protocolIds;
  }

  function hasPositionOf(address to) external view override returns (bool) {
    return balanceOf(to) > 0;
  }

  function deposit(
    address account,
    uint256 amount,
    uint256 atenToStake,
    uint128[] calldata protocolIds
  ) external override onlyCore {
    //Thao@TODO: remove this require when multi-position
    require(balanceOf(account) == 0, "Already have a position");

    IAthena _core = IAthena(core);

    for (
      uint256 firstIndex = 0;
      firstIndex < protocolIds.length;
      firstIndex++
    ) {
      IProtocolPool protocolPool1 = IProtocolPool(
        _core.getProtocolAddressById(protocolIds[firstIndex])
      );

      for (
        uint256 secondIndex = firstIndex + 1;
        secondIndex < protocolIds.length;
        secondIndex++
      ) {
        protocolPool1.addRelatedProtocol(protocolIds[secondIndex], amount);

        IProtocolPool(_core.getProtocolAddressById(protocolIds[secondIndex]))
          .addRelatedProtocol(protocolIds[firstIndex], amount);
      }

      _core.actualizingProtocolAndRemoveExpiredPolicies(address(protocolPool1));

      protocolPool1.deposit(account, amount);
      //Thao@TODO: pas besoin de add lui-même
      protocolPool1.addRelatedProtocol(protocolIds[firstIndex], amount);
    }

    uint256 __aaveScaledBalance = _core.transferLiquidityToAAVE(amount);
    uint128 _discount;
    if (atenToStake > 0) {
      _core.stakeAtens(account, atenToStake, amount);
      _discount = _core.getDiscountWithAten(atenToStake);
    }

    _positions[_nextId] = Position({
      owner: account,
      createdAt: block.timestamp,
      amountSupplied: amount,
      aaveScaledBalance: __aaveScaledBalance,
      discount: _discount,
      protocolIds: protocolIds,
      atens: atenToStake
    });

    _mint(account, _nextId);
    _nextId++;
  }

  /*
  //Thao@TODO: to complet
  function updatePosition(
    address account,
    uint256 tokenId,
    uint256 addingAmount,
    uint256 addingAtens
  ) external override onlyCore {
    require(balanceOf(account) > 0, "No active position");
    require(account == ownerOf(tokenId), "Token owner");
    require(addingAmount > 0 || addingAtens > 0, "both amounts is zero");

    IPositionsManager.Position memory _position = _positions[tokenId];

    IAthena _core = IAthena(core);

    if (addingAmount > 0) {
      // update pools in protocolsId: actualizing and remove, capital, slot0, intersectingAmount

      for (
        uint256 firstIndex = 0;
        firstIndex < _position.protocolsId.length;
        firstIndex++
      ) {
        IProtocolPool protocolPool1 = IProtocolPool(
          _core.getProtocolAddressById(_position.protocolsId[firstIndex])
        );
        for (
          uint256 secondIndex = firstIndex + 1;
          secondIndex < _position.protocolsId.length;
          secondIndex++
        ) {
          protocolPool1.addRelatedProtocol(
            _position.protocolsId[secondIndex],
            addingAmount
          );

          IProtocolPool(
            _core.getProtocolAddressById(_position.protocolsId[secondIndex])
          ).addRelatedProtocol(_position.protocolsId[firstIndex], addingAmount);
        }

        _core.actualizingProtocolAndRemoveExpiredPolicies(
          address(protocolPool1)
        );

        //Thao@TODO:
        //Il faut takeInterest avant de deposit pour update liquidityIndex et claimsIndex
        //see pool.deposit: LPsInfo[_account] = LPInfo(liquidityIndex, claims.length);
        protocolPool1.deposit(msg.sender, addingAmount);
        protocolPool1.addRelatedProtocol(
          _position.protocolsId[firstIndex],
          addingAmount
        );
      }

      _positions[tokenId].providedLiquidity += addingAmount;
      _positions[tokenId].aaveScaledBalance += _core.transferLiquidityToAAVE(
        addingAmount
      );
    }

    //Thao@TODO: verifier ce if, sur tout stakeAtens
    if (addingAtens > 0) {
      _position.atens += addingAtens;

      _positions[tokenId].atens = _position.atens;
      _positions[tokenId].discount = _core.getDiscountWithAten(_position.atens);

      _core.stakeAtens(account, addingAtens, addingAmount);
    }
  }
*/

  function isProtocolInCoverList(
    uint128 _protocolId,
    uint128[] memory _protocolList
  ) private pure returns (bool) {
    for (uint256 i = 0; i < _protocolList.length; i++) {
      if (_protocolId == _protocolList[i]) return true;
    }

    return false;
  }

  function takeInterest(
    address account,
    uint256 tokenIndex,
    uint128 protocolId
  ) external override onlyCore {
    require(balanceOf(account) > 0, "No active position");
    uint256 _tokenId = tokenOfOwnerByIndex(account, tokenIndex);

    Position memory _position = _positions[_tokenId];

    require(
      isProtocolInCoverList(protocolId, _position.protocolIds),
      "Not in deposit protocol list"
    );

    IAthena _core = IAthena(core);
    address protocolAddress = _core.getProtocolAddressById(protocolId);
    _core.actualizingProtocolAndRemoveExpiredPolicies(protocolAddress);

    (
      uint256 _newUserCapital,
      uint256 _aaveScaledBalanceToRemove
    ) = IProtocolPool(protocolAddress).takeInterest(
        account,
        _position.amountSupplied,
        _position.protocolIds,
        _position.discount
      );

    if (_position.amountSupplied != _newUserCapital) {
      _positions[_tokenId].amountSupplied = _newUserCapital;
      _positions[_tokenId].aaveScaledBalance -= _aaveScaledBalanceToRemove;
    }
  }
}
