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

    // Loop through each tokenId (i) of a user
    for (uint256 i = 0; i < tokenList.length; i++) {
      uint256 tokenId = tokenList[i];
      Position memory __position = _positions[tokenId];

      uint256 finalCapital;
      uint256 totalRewards;

      // Loop through each poolId (j) in a tokenId
      for (uint256 j = 0; j < __position.protocolIds.length; j++) {
        address poolAddress = IAthena(core).getProtocolAddressById(
          __position.protocolIds[j]
        );

        // Check the user's rewards in the pool
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

      // Include unrealized rewards & penalties in the initial capital
      __position.amountSupplied = finalCapital;

      positionList[i] = PositionInfo({
        positionId: tokenList[i],
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

  // @bw probably to delete because unused
  // function updateUserCapital(
  //   uint256 tokenId,
  //   uint256 _amount,
  //   uint256 _aaveScaledBalanceToRemove
  // ) external override onlyCore {
  //   _positions[tokenId].amountSupplied = _amount;
  //   _positions[tokenId].aaveScaledBalance -= _aaveScaledBalanceToRemove;
  // }

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

    // Save new position tokenId and update for next
    uint256 tokenId = _nextTokenId;
    _nextTokenId++;

    // Ensure that all capital dependencies between pools are registered
    // Loop through each of the pools (i)
    for (uint256 i = 0; i < protocolIds.length; i++) {
      uint128 currentPoolId = protocolIds[i];

      // Create an instance of the current pool
      IProtocolPool currentPool = IProtocolPool(
        _core.getProtocolAddressById(currentPoolId)
      );

      // Loop through each latter pool (j)
      for (uint256 j = i + 1; j < protocolIds.length; j++) {
        uint128 latterPoolId = protocolIds[j];

        // Add the latter pool to the current pool dependencies
        currentPool.addRelatedProtocol(latterPoolId, amount);

        // Mirror the dependency of the current pool in the latter pool
        IProtocolPool(_core.getProtocolAddressById(latterPoolId))
          .addRelatedProtocol(currentPoolId, amount);
      }

      _core.actualizingProtocolAndRemoveExpiredPolicies(address(currentPool));

      // Deposit fund into pool and add amount to its own intersectingAmounts
      currentPool.deposit(tokenId, amount);
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
  }

  //Thao@TODO:
  //Il faut takeInterest avant de deposit pour update liquidityIndex et claimsIndex
  //see pool.deposit: LPsInfo[_account] = LPInfo(liquidityIndex, claims.length);
  // update pools in protocolsId: actualizing and remove, capital, slot0, intersectingAmount
  function updatePosition(
    address account,
    uint256 tokenId,
    uint256 amount,
    uint128 newStakingFeeRate
  ) external override onlyCore {
    IPositionsManager.Position memory userPosition = _positions[tokenId];

    IAthena _core = IAthena(core);

    // Take interests in all pools before update
    takeInterestsInAllPools(account, tokenId);

    // Ensure that all capital dependencies between pools are registered
    // Loop through each of the pools (i)
    for (uint256 i = 0; i < userPosition.protocolIds.length; i++) {
      uint128 currentPoolId = userPosition.protocolIds[i];

      // Create an instance of the current pool
      IProtocolPool currentPool = IProtocolPool(
        _core.getProtocolAddressById(currentPoolId)
        );

      // Loop through each latter pool (j)
      for (uint256 j = i + 1; j < userPosition.protocolIds.length; j++) {
        uint128 latterPoolId = userPosition.protocolIds[j];

        // Add the latter pool to the current pool dependencies
        currentPool.addRelatedProtocol(latterPoolId, amount);

        // Mirror the dependency of the current pool in the latter pool
        IProtocolPool(_core.getProtocolAddressById(latterPoolId))
          .addRelatedProtocol(currentPoolId, amount);
        }

      _core.actualizingProtocolAndRemoveExpiredPolicies(address(currentPool));

      // Deposit fund into pool and add amount to its own intersectingAmounts
      currentPool.deposit(tokenId, amount);
    }

    // Update fee rate of positions if it has changed
    if (_positions[tokenId].feeRate != newStakingFeeRate) {
      _positions[tokenId].feeRate = newStakingFeeRate;
      }

    _positions[tokenId].amountSupplied += amount;
    // @bw this can probably be optimized with a single aave deposit (also present elsewhere)
      _positions[tokenId].aaveScaledBalance += _core.transferLiquidityToAAVE(
      amount
      );
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

  function takeInterestsInAllPools(address account, uint256 tokenId) internal {
    Position memory userPosition = _positions[tokenId];
    IAthena _core = IAthena(core);

    uint256 amountSuppliedUpdated;
    uint256 aaveScaledBalanceUpdated;
    for (uint256 i = 0; i < userPosition.protocolIds.length; i++) {
      uint128 protocolId = userPosition.protocolIds[i];

      address protocolAddress = _core.getProtocolAddressById(protocolId);
      _core.actualizingProtocolAndRemoveExpiredPolicies(protocolAddress);

      (
        uint256 _newUserCapital,
        uint256 _aaveScaledBalanceToRemove
      ) = IProtocolPool(protocolAddress).takeInterest(
          account,
          tokenId,
          userPosition.amountSupplied,
          userPosition.protocolIds,
          userPosition.feeRate
        );

      // @bw unsure of this assign, should check if only last item should update or all of them
      if (i == userPosition.protocolIds.length - 1) {
        amountSuppliedUpdated = _newUserCapital;
        aaveScaledBalanceUpdated = _aaveScaledBalanceToRemove;
      }
    }

    if (userPosition.amountSupplied != amountSuppliedUpdated) {
      _positions[tokenId].amountSupplied = amountSuppliedUpdated;
      _positions[tokenId].aaveScaledBalance -= aaveScaledBalanceUpdated;
    }
  }
}
