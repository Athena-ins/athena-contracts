// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.17;

contract DoNotImport {
  /*
  //Thao@Question: we need this function ?
  function committingWithdrawInOneProtocol(uint128 _protocolId) external {
    IPositionsManager __positionsManager = IPositionsManager(positionsManager);

    require(
      __positionsManager.balanceOf(msg.sender) > 0,
      "No position to commit withdraw"
    );

    uint256 __tokenId = __positionsManager.tokenOfOwnerByIndex(msg.sender, 0);

    (, uint128[] memory __protocolIds, , ) = __positionsManager.positions(
      __tokenId
    );

    // require(
    //   isProtocolInList(_protocolId, __protocolIds),
    //   "Not in protocol list"
    // );//isProtocolInList is moved into PositionManager

    require(
      protocolsMapping[_protocolId].claimsOngoing == 0,
      "Protocol has claims on going"
    );

    IProtocolPool(protocolsMapping[_protocolId].deployed)
      .committingWithdrawLiquidity(msg.sender);
  }
*/
  /*
  //Thao@Question: we need this function ?
  function withdrawLiquidityInOneProtocol(uint128 _protocolId) external {
    IProtocolPool __protocol = IProtocolPool(
      protocolsMapping[_protocolId].deployed
    );

    require(
      __protocol.isWithdrawLiquidityDelayOk(msg.sender),
      "Withdraw reserve"
    );

    __protocol.removeCommittedWithdrawLiquidity(msg.sender);

    IPositionsManager __positionManager = IPositionsManager(positionsManager);

    uint256 __tokenId = __positionManager.tokenOfOwnerByIndex(msg.sender, 0);

    (
      uint256 __userCapital,
      uint128[] memory __protocolIds,
      uint256 __aaveScaledBalance,
      uint128 __feeRate
    ) = __positionManager.positions(__tokenId);

    actualizingProtocolAndRemoveExpiredPolicies(address(__protocol));

    (uint256 __newUserCapital, uint256 __aaveScaledBalanceToRemove) = __protocol
      .withdrawLiquidity(msg.sender, __userCapital, __protocolIds, __feeRate);

    __protocol.removeLPInfo(msg.sender);

    if (__protocolIds.length == 1) {
      __positionManager.burn(msg.sender);

      address __lendingPool = ILendingPoolAddressesProvider(
        aaveAddressesRegistry
      ).getLendingPool();

      uint256 _amountToWithdrawFromAAVE = __aaveScaledBalance.rayMul(
        ILendingPool(__lendingPool).getReserveNormalizedIncome(stablecoin)
      );

      ILendingPool(__lendingPool).withdraw(
        stablecoin,
        _amountToWithdrawFromAAVE,
        msg.sender
      );
    } else {
      if (__userCapital != __newUserCapital) {
        __positionManager.updateUserCapital(
          __tokenId,
          __newUserCapital,
          __aaveScaledBalanceToRemove
        );
      }

      __positionManager.removeProtocolId(__tokenId, _protocolId);
    }

    //Thao@TODO: Event
  }
*/
}
