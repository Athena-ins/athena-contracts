// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./AAVE/ILendingPoolAddressesProvider.sol";
import "./AAVE/ILendingPool.sol";

import "./interfaces/IPositionsManager.sol";
import "./interfaces/IProtocolFactory.sol";
import "./interfaces/IProtocolPool.sol";
import "./interfaces/IStakedAten.sol";
import "./interfaces/IStakedAtenPolicy.sol";
import "./interfaces/IPolicyManager.sol";
import "./interfaces/IScaledBalanceToken.sol";
import "./interfaces/IClaimManager.sol";
import "./interfaces/IVaultERC20.sol";

import "hardhat/console.sol";

contract Athena is ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  struct Protocol {
    uint128 id; //id in mapping
    uint128 claimsOngoing; // claim ongoing, lock funds when claim is ongoing
    address deployed; //Protocol Pool Address deployed
    address protocolAddress; //address for the protocol interface to be unique
    uint8 premiumRate; //Premium rate to pay for this protocol
    uint8 guarantee; //Protocol guarantee type, could be 0 = smart contract vuln, 1 = unpeg, 2 = rug pull ...
    bool active; //is Active or paused
    string name; //Protocol name
  }

  event NewProtocol(uint128);

  mapping(uint128 => mapping(uint128 => bool)) public incompatibilityProtocols;
  mapping(uint128 => Protocol) public protocolsMapping;

  address public stablecoin;
  address public aaveAddressesRegistry; // AAVE lending pool
  address public positionsManager;
  address public policyManager;
  address public protocolFactory;
  address public claimManager;

  address public stakedAtensGP;
  address public stakedAtensPo;
  address public rewardsToken;
  address public aaveAtoken;
  address public atensVault;

  address public arbitrator;

  struct AtenDiscount {
    uint256 atenAmount;
    uint128 discount;
  }

  AtenDiscount[] public premiumAtenDiscount;

  uint128 private nextProtocolId;

  constructor(
    address _stablecoinUsed,
    address _rewardsToken,
    address _aaveAddressesRegistry
  ) {
    rewardsToken = _rewardsToken;
    stablecoin = _stablecoinUsed;
    aaveAddressesRegistry = _aaveAddressesRegistry;
  }

  function approveLendingPool() internal {
    IERC20(stablecoin).safeApprove(
      ILendingPoolAddressesProvider(aaveAddressesRegistry).getLendingPool(),
      2**256 - 1
    );
  }

  function initialize(
    address _positionsAddress,
    address _stakedAtensGP,
    address _stakedAtensPo,
    address _atensVault,
    address _policyManagerAddress,
    address _aaveAtoken,
    address _protocolFactory,
    address _arbitrator,
    address _claimManager
  ) external onlyOwner {
    positionsManager = _positionsAddress;
    stakedAtensGP = _stakedAtensGP;
    policyManager = _policyManagerAddress;
    aaveAtoken = _aaveAtoken;
    protocolFactory = _protocolFactory;
    arbitrator = _arbitrator;
    claimManager = _claimManager;
    stakedAtensPo = _stakedAtensPo;
    atensVault = _atensVault;
    approveLendingPool();
    //initialized = true; //@dev required ?
  }

  //Thao@WARN: also removing atensLocked !!!
  function actualizingProtocolAndRemoveExpiredPolicies(address protocolAddress)
    private
  {
    uint256[] memory __expiredPoliciesTokens = IProtocolPool(protocolAddress)
      .actualizing();
    for (uint256 i = 0; i < __expiredPoliciesTokens.length; i++) {
      // (uint256 amountGuaranteed, uint128 protocolId) = IPolicyManager(
      //   policyManager
      // ).policies(__expiredPoliciesTokens[i]);

      // address owner = IPolicyManager(policyManager).ownerOf(
      //   __expiredPoliciesTokens[i]
      // );

      // console.log("***before:");
      // console.log(
      //   "balanceOf(",
      //   owner,
      //   "):",
      //   IPolicyManager(policyManager).balanceOf(owner)
      // );
      // console.log("amountGuaranteed:", amountGuaranteed);
      // console.log("protocolId:", protocolId);

      IPolicyManager(policyManager).burn(__expiredPoliciesTokens[i]);

      // (amountGuaranteed, protocolId) = IPolicyManager(policyManager).policies(
      //   __expiredPoliciesTokens[i]
      // );

      // console.log("***after:");
      // console.log(
      //   "balanceOf(",
      //   owner,
      //   "):",
      //   IPolicyManager(policyManager).balanceOf(owner)
      // );
      // console.log("amountGuaranteed:", amountGuaranteed);
      // console.log("protocolId:", protocolId);
    }
  }

  function _transferLiquidity(uint256 _amount) internal returns (uint256) {
    IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), _amount);

    address lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();

    ILendingPool(lendingPool).deposit(stablecoin, _amount, address(this), 0);

    return
      _amount.rayDiv(
        ILendingPool(lendingPool).getReserveNormalizedIncome(stablecoin)
      );
  }

  //////Thao@NOTE: LP
  function deposit(
    uint256 amount,
    uint256 atenToStake,
    uint128[] calldata _protocolIds
  ) public payable {
    require(
      !IPositionsManager(positionsManager).hasPositionOf(msg.sender),
      "Already have a position"
    );

    for (uint256 index = 0; index < _protocolIds.length; index++) {
      Protocol memory protocol1 = protocolsMapping[_protocolIds[index]];
      require(protocol1.active == true, "Protocol not active");

      IProtocolPool protocolPool1 = IProtocolPool(protocol1.deployed);
      for (uint256 index2 = index + 1; index2 < _protocolIds.length; index2++) {
        require(
          _protocolIds[index] != _protocolIds[index2],
          "Cannot deposit twice on same protocol"
        );

        require(
          incompatibilityProtocols[_protocolIds[index2]][_protocolIds[index]] ==
            false &&
            incompatibilityProtocols[_protocolIds[index]][
              _protocolIds[index2]
            ] ==
            false,
          "Protocol not compatible"
        );

        protocolPool1.addRelatedProtocol(_protocolIds[index2], amount);

        IProtocolPool(protocolsMapping[_protocolIds[index2]].deployed)
          .addRelatedProtocol(_protocolIds[index], amount);
      }

      actualizingProtocolAndRemoveExpiredPolicies(protocol1.deployed);

      protocolPool1.deposit(msg.sender, amount);
      protocolPool1.addRelatedProtocol(_protocolIds[index], amount);
    }

    uint256 __aaveScaledBalance = _transferLiquidity(amount);
    uint128 _discount = 0;
    if (atenToStake > 0) {
      _stakeAtens(atenToStake, amount);
      _discount = getDiscountWithAten(atenToStake);
    }

    IPositionsManager(positionsManager).createPosition(
      msg.sender,
      _discount,
      amount,
      __aaveScaledBalance,
      atenToStake,
      _protocolIds
    );
  }

  function isProtocolInList(uint128 _protocolId, uint128[] memory _protocolList)
    private
    pure
    returns (bool)
  {
    for (uint256 i = 0; i < _protocolList.length; i++) {
      if (_protocolId == _protocolList[i]) return true;
    }

    return false;
  }

  function takeInterest(uint128 _protocolId) public {
    (
      uint256 __userCapital,
      uint128[] memory __protocolIds,
      ,
      uint256 __discount
    ) = IPositionsManager(positionsManager).positions(msg.sender);

    require(
      isProtocolInList(_protocolId, __protocolIds),
      "Not in protocol list"
    );

    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[_protocolId].deployed
    );

    (
      uint256 __newUserCapital,
      uint256 __aaveScaledBalanceToRemove
    ) = IProtocolPool(protocolsMapping[_protocolId].deployed).takeInterest(
        msg.sender,
        __userCapital,
        __protocolIds,
        __discount
      );

    if (__userCapital != __newUserCapital)
      IPositionsManager(positionsManager).updateUserCapital(
        msg.sender,
        __newUserCapital,
        __aaveScaledBalanceToRemove
      );
  }

  //Thao@Question: we need this function ?
  // function committingWithdrawInOneProtocol(uint128 _protocolId) external {
  //   IPositionsManager __positionsManager = IPositionsManager(positionsManager);

  //   require(
  //     __positionsManager.hasPositionOf(msg.sender),
  //     "No position to commit withdraw"
  //   );

  //   (, uint128[] memory __protocolIds, , ) = __positionsManager.positions(
  //     msg.sender
  //   );

  //   require(
  //     isProtocolInList(_protocolId, __protocolIds),
  //     "Not in protocol list"
  //   );

  //   require(
  //     protocolsMapping[_protocolId].claimsOngoing == 0,
  //     "Protocol has claims on going"
  //   );

  //   IProtocolPool(protocolsMapping[_protocolId].deployed)
  //     .committingWithdrawLiquidity(msg.sender);
  // }

  //Thao@Question: we need this function ?
  // function withdrawLiquidityInOneProtocol(uint128 _protocolId) external {
  //   IProtocolPool __protocol = IProtocolPool(
  //     protocolsMapping[_protocolId].deployed
  //   );

  //   require(
  //     __protocol.isWithdrawLiquidityDelayOk(msg.sender),
  //     "Withdraw reserve"
  //   );

  //   __protocol.removeCommittedWithdrawLiquidity(msg.sender);

  //   IPositionsManager __positionManager = IPositionsManager(positionsManager);

  //   (
  //     uint256 __userCapital,
  //     uint128[] memory __protocolIds,
  //     uint256 __aaveScaledBalance,
  //     uint128 __discount
  //   ) = __positionManager.positions(msg.sender);

  //   actualizingProtocolAndRemoveExpiredPolicies(address(__protocol));

  //   (uint256 __newUserCapital, uint256 __aaveScaledBalanceToRemove) = __protocol
  //     .withdrawLiquidity(msg.sender, __userCapital, __protocolIds, __discount);

  //   __protocol.removeLPInfo(msg.sender);

  //   if (__protocolIds.length == 1) {
  //     __positionManager.removePosition(msg.sender);

  //     address __lendingPool = ILendingPoolAddressesProvider(
  //       aaveAddressesRegistry
  //     ).getLendingPool();

  //     uint256 _amountToWithdrawFromAAVE = __aaveScaledBalance.rayMul(
  //       ILendingPool(__lendingPool).getReserveNormalizedIncome(stablecoin)
  //     );

  //     ILendingPool(__lendingPool).withdraw(
  //       stablecoin,
  //       _amountToWithdrawFromAAVE,
  //       msg.sender
  //     );
  //   } else {
  //     if (__userCapital != __newUserCapital) {
  //       __positionManager.updateUserCapital(
  //         msg.sender,
  //         __newUserCapital,
  //         __aaveScaledBalanceToRemove
  //       );
  //     }

  //     __positionManager.removeProtocolId(msg.sender, _protocolId);
  //   }

  //   //Thao@TODO: Event
  // }

  function committingWithdrawAll() external {
    require(
      IPositionsManager(positionsManager).hasPositionOf(msg.sender),
      "No position to commit withdraw"
    );

    (, uint128[] memory _protocolIds, , ) = IPositionsManager(positionsManager)
      .positions(msg.sender);

    for (uint256 index = 0; index < _protocolIds.length; index++)
      IProtocolPool(protocolsMapping[_protocolIds[index]].deployed)
        .committingWithdrawLiquidity(msg.sender);
  }

  function withdrawAll() external {
    IPositionsManager __positionsManager = IPositionsManager(positionsManager);

    (
      uint256 __userCapital,
      uint128[] memory __protocolIds,
      uint256 __aaveScaledBalance,
      uint128 __discount
    ) = __positionsManager.positions(msg.sender);

    uint256 __newUserCapital;
    uint256 __aaveScaledBalanceToRemove;
    for (uint256 index = 0; index < __protocolIds.length; index++) {
      IProtocolPool __protocol = IProtocolPool(
        protocolsMapping[__protocolIds[index]].deployed
      );

      require(
        __protocol.isWithdrawLiquidityDelayOk(msg.sender),
        "Withdraw reserve"
      );

      __protocol.removeCommittedWithdrawLiquidity(msg.sender);

      actualizingProtocolAndRemoveExpiredPolicies(address(__protocol));

      (__newUserCapital, __aaveScaledBalanceToRemove) = __protocol
        .withdrawLiquidity(
          msg.sender,
          __userCapital,
          __protocolIds,
          __discount
        );

      __protocol.removeLPInfo(msg.sender);
    }

    __positionsManager.removePosition(msg.sender);

    address __lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();

    uint256 _amountToWithdrawFromAAVE = __aaveScaledBalance.rayMul(
      ILendingPool(__lendingPool).getReserveNormalizedIncome(stablecoin)
    );

    ILendingPool(__lendingPool).withdraw(
      stablecoin,
      _amountToWithdrawFromAAVE,
      msg.sender
    );
  }

  //////Thao@NOTE: Policy
  function buyPolicy(
    uint256 _amountGuaranteed,
    uint256 _premium,
    uint256 _atensLocked,
    uint128 _protocolId
  ) public payable nonReentrant {
    require(
      _amountGuaranteed > 0 && _premium > 0,
      "Guarante and premium must be greater than 0"
    );

    IERC20(stablecoin).safeTransferFrom(
      msg.sender,
      protocolsMapping[_protocolId].deployed,
      _premium
    );

    if (_atensLocked > 0) {
      //@dev TODO get oracle price !
      uint256 pricePrecision = 10000;
      uint256 __price = 100; // = 100 / 10.000 = 0.01 USDT
      uint256 __decimalsRatio = 10**18 / 10**ERC20(stablecoin).decimals();
      require(
        (__price * _atensLocked) / pricePrecision <=
          (_premium * __decimalsRatio),
        "Too many ATENS"
      );
      IStakedAtenPolicy(stakedAtensPo).stake(msg.sender, _atensLocked);
    }

    uint256 __tokenId = IPolicyManager(policyManager).mint(
      msg.sender,
      _amountGuaranteed,
      _atensLocked,
      _protocolId
    );

    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[_protocolId].deployed
    );

    IProtocolPool(protocolsMapping[_protocolId].deployed).buyPolicy(
      msg.sender,
      __tokenId,
      _premium,
      _amountGuaranteed
    );
  }

  function startClaim(
    uint256 _policyId,
    uint256 _index,
    uint256 _amountClaimed
  ) external payable {
    require(_amountClaimed > 0, "Claimed amount is zero");

    IPolicyManager __policyManager = IPolicyManager(policyManager);

    require(
      msg.sender == __policyManager.ownerOf(_policyId),
      "Policy is not owned"
    );
    require(
      _policyId == __policyManager.tokenOfOwnerByIndex(msg.sender, _index),
      "Wrong Token Id for Policy"
    );

    (uint256 __liquidity, uint128 __protocolId) = __policyManager.policies(
      _policyId
    );

    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[__protocolId].deployed
    );

    require(__policyManager.balanceOf(msg.sender) > 0, "No Active Policy");
    require(__liquidity >= _amountClaimed, "Too big claimed amount");

    IClaimManager(claimManager).claim{ value: msg.value }(
      msg.sender,
      _policyId,
      _amountClaimed
    );

    protocolsMapping[__protocolId].claimsOngoing += 1;
  }

  modifier onlyClaimManager() {
    require(msg.sender == claimManager, "Only Claim Manager");
    _;
  }

  //onlyClaimManager
  function resolveClaim(
    uint256 _policyId,
    uint256 _amount,
    address _account
  ) external {
    address _accountConfirm = IPolicyManager(policyManager).ownerOf(_policyId);

    // console.log("Account : ", _account);
    // console.log("Policy Id : ", _policyId);
    // console.log("Account confirm : ", _accountConfirm);

    require(_account == _accountConfirm, "Wrong account");

    (, uint128 __protocolId) = IPolicyManager(policyManager).policies(
      _policyId
    );

    IProtocolPool __protocolPool = IProtocolPool(
      protocolsMapping[__protocolId].deployed
    );

    uint256 __ratio = __protocolPool.ratioWithAvailableCapital(_amount);
    uint256 __reserveNormalizedIncome = ILendingPool(
      ILendingPoolAddressesProvider(aaveAddressesRegistry).getLendingPool()
    ).getReserveNormalizedIncome(stablecoin);

    uint128[] memory __relatedProtocols = __protocolPool.getRelatedProtocols();
    for (uint256 i = 0; i < __relatedProtocols.length; i++) {
      actualizingProtocolAndRemoveExpiredPolicies(
        protocolsMapping[__relatedProtocols[i]].deployed
      );

      IProtocolPool(protocolsMapping[__relatedProtocols[i]].deployed)
        .processClaim(__protocolId, __ratio, __reserveNormalizedIncome);
    }

    ILendingPool(
      ILendingPoolAddressesProvider(aaveAddressesRegistry).getLendingPool()
    ).withdraw(stablecoin, _amount, _account);

    // protocolsMapping[__protocolId].claimsOngoing -= 1;//use for later
  }

  function withdrawPolicy(uint256 _policyId, uint256 _index)
    public
    payable
    nonReentrant
  {
    IPolicyManager __policyManager = IPolicyManager(policyManager);

    require(__policyManager.balanceOf(msg.sender) > 0, "No Active Policy");
    require(
      _policyId == __policyManager.tokenOfOwnerByIndex(msg.sender, _index),
      "Wrong Token Id for Policy"
    );
    require(
      msg.sender == __policyManager.ownerOf(_policyId),
      "Policy is not owned"
    );

    (, uint128 __protocolId) = __policyManager.policies(_policyId);
    //Thao@Question: on fait quoi avec 'atensLocked' ???

    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[__protocolId].deployed
    );

    IProtocolPool(protocolsMapping[__protocolId].deployed).withdrawPolicy(
      msg.sender
    );

    __policyManager.burn(_policyId);
  }

  //////Thao@NOTE: Protocol
  function _stakeAtens(uint256 atenToStake, uint256 amount) internal {
    IStakedAten(stakedAtensGP).stake(msg.sender, atenToStake, amount);
  }

  function withdrawAtens(uint256 atenToWithdraw) external {
    //@dev TODO check if multiple NFT positions

    (
      uint256 liquidity,
      uint128[] memory protocolsId,
      uint256 atokens,

    ) = IPositionsManager(positionsManager).positions(msg.sender);
    uint128 _discount = getDiscountWithAten(liquidity);
    uint256 actualAtens = IStakedAten(stakedAtensGP).balanceOf(msg.sender);
    require(actualAtens > 0, "No Atens to withdraw");
    // require(atenToWithdraw <= actualAtens, "Not enough Atens to withdraw");
    IStakedAten(stakedAtensGP).withdraw(msg.sender, atenToWithdraw);
    IPositionsManager(positionsManager).update(
      msg.sender,
      _discount,
      liquidity,
      atokens,
      actualAtens - atenToWithdraw,
      protocolsId
    );
  }

  function withdrawAtensPolicy(uint256 _atenToWithdraw, uint128 _index)
    external
  {
    uint256 __rewards = IStakedAtenPolicy(stakedAtensPo).withdraw(
      msg.sender,
      _atenToWithdraw,
      _index
    );
    if (
      __rewards > 0 && __rewards <= IERC20(rewardsToken).balanceOf(atensVault)
    ) {
      IVaultERC20(atensVault).transfer(msg.sender, __rewards);
      //IERC20(rewardsToken).transferFrom(atensVault, msg.sender, __rewards);
    }
  }

  function setDiscountWithAten(AtenDiscount[] calldata _discountToSet)
    public
    onlyOwner
  {
    for (uint256 index = 0; index < _discountToSet.length; index++) {
      premiumAtenDiscount.push(_discountToSet[index]);
    }
  }

  function getDiscountWithAten(uint256 _amount) public view returns (uint128) {
    for (uint256 index = 0; index < premiumAtenDiscount.length; index++) {
      if (_amount < premiumAtenDiscount[index].atenAmount)
        return index == 0 ? 0 : premiumAtenDiscount[index - 1].discount;
    }
    // Else we are above max discount, so give it max discount
    return premiumAtenDiscount[premiumAtenDiscount.length - 1].discount;
  }

  function addNewProtocol(
    string calldata name,
    uint8 guaranteeType,
    uint8 premium, //Thao@NOTE: not used
    address iface,
    uint128[] calldata protocolsNotCompat
  ) public onlyOwner {
    uint128 newProtocolId = nextProtocolId;
    nextProtocolId++;

    address _protocolDeployed = IProtocolFactory(protocolFactory)
      .deployProtocol(
        name,
        stablecoin,
        newProtocolId,
        75 * 1e27,
        1e27,
        5e27,
        11e26
      );

    Protocol memory newProtocol = Protocol({
      id: newProtocolId,
      name: name,
      protocolAddress: iface,
      premiumRate: premium,
      guarantee: guaranteeType,
      deployed: _protocolDeployed,
      active: true,
      claimsOngoing: 0
    });

    for (uint256 i = 0; i < protocolsNotCompat.length; i++) {
      incompatibilityProtocols[newProtocolId][protocolsNotCompat[i]] = true;
    }

    protocolsMapping[newProtocolId] = newProtocol;

    emit NewProtocol(newProtocolId);
  }

  function protocolsLength() external view returns (uint256) {
    return nextProtocolId;
  }

  function pauseProtocol(uint128 protocolId, bool pause) external onlyOwner {
    protocolsMapping[protocolId].active = pause;
  }

  struct ProtocolView {
    string symbol;
    string name;
    uint128 protocolId;
    uint256 totalCouvrageValue;
    uint256 availableCapacity;
    uint256 utilizationRate;
    uint256 premiumRate;
  }

  function linearProtocolsView(uint128 beginId, uint256 numberOfProtocols)
    external
    view
    returns (ProtocolView[] memory protocolsInfo)
  {
    require(beginId < nextProtocolId, "begin Id is not exist");

    uint256 __numberOfProtocols = nextProtocolId - beginId >= numberOfProtocols
      ? numberOfProtocols
      : nextProtocolId - beginId;

    protocolsInfo = new ProtocolView[](__numberOfProtocols);
    for (uint128 i = 0; i < __numberOfProtocols; i++) {
      (
        string memory symbol,
        string memory name,
        uint256 totalCouvrageValue,
        uint256 availableCapacity,
        uint256 utilizationRate,
        uint256 premiumRate
      ) = IProtocolPool(protocolsMapping[beginId + i].deployed).protocolInfo();

      protocolsInfo[i] = ProtocolView(
        symbol,
        name,
        beginId + i,
        totalCouvrageValue,
        availableCapacity,
        utilizationRate,
        premiumRate
      );
    }
  }

  function protocolsView(uint128[] calldata protocolsId)
    external
    view
    returns (ProtocolView[] memory protocolsInfo)
  {
    protocolsInfo = new ProtocolView[](protocolsId.length);
    for (uint128 i = 0; i < protocolsId.length; i++) {
      (
        string memory symbol,
        string memory name,
        uint256 totalCouvrageValue,
        uint256 availableCapacity,
        uint256 utilizationRate,
        uint256 premiumRate
      ) = IProtocolPool(protocolsMapping[protocolsId[i]].deployed)
          .protocolInfo();

      protocolsInfo[i] = ProtocolView(
        symbol,
        name,
        protocolsId[i],
        totalCouvrageValue,
        availableCapacity,
        utilizationRate,
        premiumRate
      );
    }
  }
}
