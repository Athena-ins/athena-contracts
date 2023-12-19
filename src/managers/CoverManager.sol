// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

// Interfaces
import { ICoverManager } from "../interfaces/ICoverManager.sol";
import { ILiquidityManager } from "../interfaces/ILiquidityManager.sol";
import { IVPool } from "../interfaces/IVPool.sol";

contract CoverManager is ICoverManager, ERC721Enumerable {
  address public core;
  address public protocolFactoryInterface;
  ILiquidityManager public liquidityManager;

  /// Maps a cover ID to the cover data
  mapping(uint256 => Policy) public covers;
  /// The ID of the next cover to be minted
  uint176 public nextCoverId = 0;

  constructor(
    address coreAddress,
    address protocolFactory,
    ILiquidityManager liquidityManager_
  ) ERC721("Athena-Cover", "Athena Insurance User Cover") {
    core = coreAddress;
    liquidityManager = liquidityManager_;
  }

  /// =========================== ///
  /// ========= MODIFIER ======== ///
  /// =========================== ///

  modifier onlyCore() {
    require(msg.sender == core, "CM: Only core");
    _;
  }

  /// ======================== ///
  /// ========= VIEWS ======== ///
  /// ======================== ///

  function policyActive(
    uint256 coverId
  ) external view returns (bool) {
    Policy memory cover = covers[coverId];

    return cover.amountCovered != 0 && cover.endTimestamp == 0;
  }

  function poolIdOfPolicy(
    uint256 coverId
  ) external view returns (uint128) {
    return covers[coverId].poolId;
  }

  function coverAmountOfPolicy(
    uint256 coverId
  ) external view returns (uint256) {
    return covers[coverId].amountCovered;
  }

  function getCover(
    uint256 coverId
  ) public view returns (Policy memory) {
    return covers[coverId];
  }

  // @bw deprecated
  function policy(
    uint256 _tokenId
  ) public view override returns (Policy memory) {
    return covers[_tokenId];
  }

  function allPolicyTokensOfOwner(
    address owner
  ) public view returns (uint256[] memory tokenList) {
    uint256 tokenLength = balanceOf(owner);
    tokenList = new uint256[](tokenLength);
    for (uint256 i = 0; i < tokenLength; i++)
      tokenList[i] = tokenOfOwnerByIndex(owner, i);
  }

  function allPoliciesOfOwner(
    address owner
  ) external view returns (Policy[] memory policyList) {
    uint256[] memory tokenList = allPolicyTokensOfOwner(owner);
    policyList = new Policy[](tokenList.length);
    for (uint256 i = 0; i < tokenList.length; i++)
      policyList[i] = covers[tokenList[i]];
  }

  function fullCoverData(
    uint256 coverId
  ) public view returns (FullCoverData memory) {
    Policy memory cover = policy(coverId);

    uint256 premiumLeft;
    uint256 currentEmissionRate;
    uint256 estDuration;

    // We only want to read additional cover data if it is ongoing
    if (cover.endTimestamp == 0) {
      (premiumLeft, currentEmissionRate, estDuration) = IVPool(
        address(0)
      ).getInfo(coverId);
    }

    address coverOwner = ownerOf(coverId);

    return
      FullCoverData({
        owner: coverOwner,
        coverId: coverId,
        poolId: cover.poolId,
        cancelledByUser: cover.cancelledByUser,
        amountCovered: cover.amountCovered,
        premiumDeposit: cover.premiumDeposit,
        beginCoveredTime: cover.beginCoveredTime,
        endTimestamp: cover.endTimestamp,
        premiumLeft: premiumLeft,
        dailyCost: currentEmissionRate,
        remainingDuration: estDuration
      });
  }

  function fullCoverDataByAccount(
    address account
  ) public view returns (FullCoverData[] memory accountCovers) {
    uint256[] memory coverIds = allPolicyTokensOfOwner(account);

    accountCovers = new FullCoverData[](coverIds.length);
    for (uint256 i = 0; i < coverIds.length; i++) {
      uint256 coverId = coverIds[i];

      accountCovers[i] = fullCoverData(coverId);
    }
  }

  function getCoverPremiumSpent(
    uint256 coverId
  ) external view returns (uint256 premiumSpent) {
    Policy memory _policy = policy(coverId);

    if (_policy.beginCoveredTime == 0) return 0;

    (uint256 premiumLeft, , ) = IVPool(address(0)).getInfo(coverId);

    // @bw Erronous behavior that grow premiums above deposited amount
    if (_policy.premiumDeposit < premiumLeft) {
      premiumSpent = _policy.premiumDeposit;
    } else {
      premiumSpent = _policy.premiumDeposit - premiumLeft;
    }

    // @thao comment abose if and uncomment following line for test
    // premiumSpent = _policy.premiumDeposit - premiumLeft;
  }

  /// ========================= ///
  /// ========= CREATE ======== ///
  /// ========================= ///

  function mint(
    address _to,
    uint256 _amountCovered,
    uint256 _premiumDeposit,
    uint128 _poolId
  ) external onlyCore returns (uint256) {
    uint256 coverId = nextCoverId;
    nextCoverId++;

    covers[coverId] = Policy({
      poolId: _poolId,
      amountCovered: _amountCovered,
      premiumDeposit: _premiumDeposit,
      beginCoveredTime: block.timestamp,
      endTimestamp: 0,
      cancelledByUser: false
    });

    // @bw should delete OZ mint event to save gas
    _mint(_to, coverId);

    return coverId;
  }

  /// ========================= ///
  /// ========= UPDATE ======== ///
  /// ========================= ///

  function increaseCover(
    uint256 coverId_,
    uint256 amount_
  ) external onlyCore {
    covers[coverId_].amountCovered += amount_;
  }

  function decreaseCover(
    uint256 coverId_,
    uint256 amount_
  ) external onlyCore {
    covers[coverId_].amountCovered -= amount_;
  }

  function addPremiums(
    uint256 coverId_,
    uint256 amount_
  ) external onlyCore {
    covers[coverId_].premiumDeposit += amount_;
  }

  function removePremiums(
    uint256 coverId_,
    uint256 amount_
  ) external onlyCore {
    covers[coverId_].premiumDeposit -= amount_;
  }

  /// ======================== ///
  /// ========= CLOSE ======== ///
  /// ======================== ///

  function expireCover(
    uint256 coverId,
    bool cancelledByUser
  ) public onlyCore {
    Policy storage cover = covers[coverId];

    cover.endTimestamp = block.timestamp;
    cover.cancelledByUser = cancelledByUser;

    // @bw check if spent premium is correct after manual expiration
    // if (cancelledByUser) {
    //   address protocolAddress = protocolFactoryInterface.getPoolAddress(
    //     cover.poolId
    //   );
    //   (uint256 premiumLeft, , ) = IProtocolPool(protocolAddress).getInfo(
    //     coverId
    //   );
    //   cover.premiumSpent = cover.premiumDeposit - premiumLeft;
    // } else {
    //   //
    // }
  }

  // @bw Thao@TODO: cette fct doit retourner capitalToRemove
  function processExpiredTokens(
    uint256[] calldata expiredCoverIds
  ) external override onlyCore {
    for (uint256 i = 0; i < expiredCoverIds.length; i++) {
      uint256 coverId = expiredCoverIds[i];
      expireCover(coverId, false);
    }
  }
}
