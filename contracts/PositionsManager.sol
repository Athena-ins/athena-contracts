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
  uint176 private _nextTokenId = 0;

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
      uint256 tokenId = tokenList[index];
      Position memory __position = _positions[tokenId];

      uint256 finalCapital;
      uint256 totalRewards;
      for (uint256 i = 0; i < __position.protocolIds.length; i++) {
        address poolAddress = IAthena(core).getProtocolAddressById(
          __position.protocolIds[i]
        );

        (uint256 __newUserCapital, uint256 __totalRewards, ) = IProtocolPool(
          poolAddress
        ).rewardsOf(
            tokenId,
            __position.amountSupplied,
            __position.protocolIds,
            __position.feeRate,
            block.timestamp
          );

        totalRewards += __totalRewards;
        finalCapital = __newUserCapital;
      }

      __position.amountSupplied = finalCapital;

      positionList[index] = PositionInfo({
        positionId: tokenList[index],
        premiumReceived: totalRewards,
        position: __position
      });
    }
  }

  function allCapitalSuppliedByAccount(address account_)
    external
    view
    returns (uint256 _capitalSupplied)
  {
    // @bw WARN this is ok for now but incomplete since the amount is raw
    // this should probably be adjusted with claims losses and APR gains
    uint256[] memory tokenList = allPositionTokensOfOwner(account_);

    for (uint256 index = 0; index < tokenList.length; index++) {
      Position memory _position = _positions[tokenList[index]];

      _capitalSupplied += _position.amountSupplied;
    }
  }

  // @bw fn is redundant with deposit in this contrat
  // should be deleted
  // function mint(
  //   address to,
  //   uint128 _feeRate,
  //   uint256 amount,
  //   uint256 _aaveScaledBalance,
  //   uint256 atenStake,
  //   uint128[] calldata _protocolIds
  // ) external override onlyCore {
  //   _positions[_nextTokenId] = Position({
  //     createdAt: block.timestamp,
  //     owner: to,
  //     amountSupplied: amount,
  //     aaveScaledBalance: _aaveScaledBalance,
  //     feeRate: _feeRate,
  //     protocolIds: _protocolIds,
  //   });

  //   _mint(to, _nextTokenId);
  //   _nextTokenId++;
  // }

  function burn(uint256 tokenId) external override onlyCore {
    _burn(tokenId);
  }

  // @bw fn is redundant with updatePosition in this contrat
  // function update(
  //   uint256 tokenId,
  //   uint256 amount,
  //   uint256 _aaveScaledBalance,
  //   uint128 _feeRate,
  //   uint128[] calldata _protocolIds
  // ) external override onlyCore {
  //   _positions[tokenId].amountSupplied = amount;
  //   _positions[tokenId].aaveScaledBalance = _aaveScaledBalance;
  //   _positions[tokenId].feeRate = _feeRate;
  //   _positions[tokenId].protocolIds = _protocolIds;
  // }

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
    uint128 feeRate,
    uint128[] calldata protocolIds
  ) external override onlyCore {
    IAthena _core = IAthena(core);

    uint256 tokenId = _nextTokenId;

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

      protocolPool1.deposit(tokenId, amount);
      //Thao@TODO: pas besoin de add lui-même
      protocolPool1.addRelatedProtocol(protocolIds[firstIndex], amount);
    }

    uint256 __aaveScaledBalance = _core.transferLiquidityToAAVE(amount);

    _positions[tokenId] = Position({
      createdAt: block.timestamp,
      amountSupplied: amount,
      aaveScaledBalance: __aaveScaledBalance,
      feeRate: feeRate,
      protocolIds: protocolIds
    });

    _mint(account, tokenId);
    _nextTokenId++;
  }

  //Thao@TODO: to complet
  function updatePosition(
    address account,
    uint256 tokenId,
    uint256 amount,
    uint128 newStakingFeeRate
  ) external override onlyCore {
    IPositionsManager.Position memory userPosition = _positions[tokenId];

    IAthena _core = IAthena(core);

      // update pools in protocolsId: actualizing and remove, capital, slot0, intersectingAmount

      for (
        uint256 firstIndex = 0;
      firstIndex < userPosition.protocolIds.length;
        firstIndex++
      ) {
        IProtocolPool protocolPool1 = IProtocolPool(
        _core.getProtocolAddressById(userPosition.protocolIds[firstIndex])
        );

        for (
          uint256 secondIndex = firstIndex + 1;
        secondIndex < userPosition.protocolIds.length;
          secondIndex++
        ) {
          protocolPool1.addRelatedProtocol(
          userPosition.protocolIds[secondIndex],
          amount
          );

          IProtocolPool(
          _core.getProtocolAddressById(userPosition.protocolIds[secondIndex])
        ).addRelatedProtocol(userPosition.protocolIds[firstIndex], amount);
        }

      _core.actualizingProtocolAndRemoveExpiredPolicies(address(protocolPool1));

        //Thao@TODO:
        //Il faut takeInterest avant de deposit pour update liquidityIndex et claimsIndex
        //see pool.deposit: LPsInfo[_account] = LPInfo(liquidityIndex, claims.length);
      protocolPool1.deposit(tokenId, amount);
        protocolPool1.addRelatedProtocol(
        userPosition.protocolIds[firstIndex],
        amount
        );
      }

    _positions[tokenId].amountSupplied += amount;
      _positions[tokenId].aaveScaledBalance += _core.transferLiquidityToAAVE(
      amount
      );

    //Thao@TODO: verifier ce if, sur tout stakeAtens
    if (1 > 0) {
      _positions[tokenId].feeRate = _core.getFeeRateWithAten(
        42 + 1 // @bw bad total
      );

      // _core._stakeAtens(account, addingAtens, amount);
    }
  }

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
    uint256 tokenId,
    uint128 protocolId
  ) external override onlyCore {
    Position memory _position = _positions[tokenId];

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
        tokenId,
        _position.amountSupplied,
        _position.protocolIds,
        _position.feeRate
      );

    if (_position.amountSupplied != _newUserCapital) {
      _positions[tokenId].amountSupplied = _newUserCapital;
      _positions[tokenId].aaveScaledBalance -= _aaveScaledBalanceToRemove;
    }
  }
}
