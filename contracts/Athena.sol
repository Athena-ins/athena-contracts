// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./AAVE/ILendingPoolAddressesProvider.sol";
import "./AAVE/ILendingPool.sol";

import "./interfaces/IAthena.sol";
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

contract Athena is IAthena, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using RayMath for uint256;

  event NewProtocol(uint128);

  mapping(uint128 => mapping(uint128 => bool)) public incompatibilityProtocols;
  mapping(uint128 => Protocol) public protocolsMapping;

  address public stablecoin;
  address public aaveAddressesRegistry; // AAVE lending pool
  address public protocolFactory;
  address public positionsManager;
  address public override policyManager;
  address public claimManager;

  /// @notice Staking Pool Contract: General Pool (GP)
  address public stakedAtensGP;
  /// @notice Staking Pool Contract: Policy
  address public stakedAtensPo;
  address public rewardsToken;
  address public atensVault;

  struct AtenDiscount {
    uint256 atenAmount;
    uint128 discount;
  }

  AtenDiscount[] public premiumAtenDiscount;

  uint128 public override nextProtocolId;

  struct ProtocolView {
    string name;
    uint128 protocolId;
    uint256 totalCouvrageValue;
    uint256 availableCapacity;
    uint256 utilizationRate;
    uint256 premiumRate;
  }

  constructor(
    address _stablecoinUsed,
    address _rewardsToken,
    address _aaveAddressesRegistry
  ) {
    rewardsToken = _rewardsToken;
    stablecoin = _stablecoinUsed;
    aaveAddressesRegistry = _aaveAddressesRegistry;
  }

  function initialize(
    address _positionsAddress,
    address _stakedAtensGP,
    address _stakedAtensPo,
    address _atensVault,
    address _policyManagerAddress,
    address _protocolFactory,
    address _claimManager
  ) external onlyOwner {
    positionsManager = _positionsAddress;
    stakedAtensGP = _stakedAtensGP;
    stakedAtensPo = _stakedAtensPo;
    policyManager = _policyManagerAddress;
    protocolFactory = _protocolFactory;

    claimManager = _claimManager;
    atensVault = _atensVault;
    approveLendingPool();
    //initialized = true; //@dev required ?
  }

  function setAAVEAddressesRegistry(address _aaveAddressesRegistry)
    external
    onlyOwner
  {
    aaveAddressesRegistry = _aaveAddressesRegistry;
  }

  function approveLendingPool() internal {
    IERC20(stablecoin).safeApprove(
      ILendingPoolAddressesProvider(aaveAddressesRegistry).getLendingPool(),
      2**256 - 1
    );
  }

  function getProtocolAddressById(uint128 protocolId)
    external
    view
    override
    returns (address)
  {
    return protocolsMapping[protocolId].deployed;
  }

  //Thao@WARN: also removing atensLocked !!!
  function actualizingProtocolAndRemoveExpiredPolicies(address protocolAddress)
    public
    override
  {
    uint256[] memory __expiredTokens = IProtocolPool(protocolAddress)
      .actualizing();

    IPolicyManager(policyManager).processExpiredTokens(__expiredTokens);
  }

  //onlyPositionManager
  function transferLiquidityToAAVE(uint256 amount)
    external
    override
    returns (uint256)
  {
    address lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();

    ILendingPool(lendingPool).deposit(stablecoin, amount, address(this), 0);

    return
      amount.rayDiv(
        ILendingPool(lendingPool).getReserveNormalizedIncome(stablecoin)
      );
  }

  /// ============================ ///
  /// ========== MODIFIERS ========== ///
  /// ============================ ///

  modifier onlyClaimManager() {
    require(msg.sender == claimManager, "Only Claim Manager");
    _;
  }

  modifier checkTokenOwner(uint256 tokenId_) {
    // @dev Check caller is owner of the cover NFT
    address ownerOfToken = IPositionsManager(positionsManager).ownerOf(
      tokenId_
    );
    require(msg.sender == ownerOfToken, "A: Caller is not the owner");
    _;
  }

  //////Thao@NOTE: LP
  modifier valideProtocolIds(uint128[] calldata protocolIds) {
    for (
      uint256 firstIndex = 0;
      firstIndex < protocolIds.length;
      firstIndex++
    ) {
      Protocol memory firstProtocol = protocolsMapping[protocolIds[firstIndex]];
      require(firstProtocol.active == true, "PA");

      for (
        uint256 secondIndex = firstIndex + 1;
        secondIndex < protocolIds.length;
        secondIndex++
      ) {
        require(protocolIds[firstIndex] != protocolIds[secondIndex], "DTSP");

        require(
          incompatibilityProtocols[protocolIds[firstIndex]][
            protocolIds[secondIndex]
          ] ==
            false &&
            incompatibilityProtocols[protocolIds[secondIndex]][
              protocolIds[firstIndex]
            ] ==
            false,
          "PC"
        );
      }
    }

    _;
  }

  /// ================================== ///
  /// ========== ATEN STAKING ========== ///
  /// ================================== ///

  //////Thao@NOTE: Protocol
  function stakeAtens(
    address account,
    uint256 atenToStake,
    uint256 amount
  ) external override {
    IStakedAten(stakedAtensGP).stake(account, atenToStake, amount);
  }

  /*
  function withdrawAtens(uint256 atenToWithdraw) external {
    //@dev TODO check if multiple NFT positions
    uint256 tokenId = IPositionsManager(positionsManager).tokenOfOwnerByIndex(
      msg.sender,
      0
    );

    IPositionsManager.Position memory __position = IPositionsManager(
      positionsManager
    ).position(tokenId);
    uint128 _discount = getDiscountWithAten(__position.atens);
    uint256 actualAtens = IStakedAten(stakedAtensGP).balanceOf(msg.sender);
    require(actualAtens > 0, "No Atens to withdraw");
    // require(atenToWithdraw <= actualAtens, "Not enough Atens to withdraw");
    IStakedAten(stakedAtensGP).withdraw(msg.sender, atenToWithdraw);
    IPositionsManager(positionsManager).update(
      tokenId,
      __position.amountSupplied,
      __position.aaveScaledBalance,
      actualAtens - atenToWithdraw,
      _discount,
      __position.protocolIds
    );
  }
*/

  /*
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
*/
  function setDiscountWithAten(AtenDiscount[] calldata _discountToSet)
    public
    onlyOwner
  {
    for (uint256 index = 0; index < _discountToSet.length; index++) {
      premiumAtenDiscount.push(_discountToSet[index]);
    }
  }

  function getDiscountWithAten(uint256 _amount)
    public
    view
    override
    returns (uint128)
  {
    for (uint256 index = premiumAtenDiscount.length - 1; index > 0; index--) {
      if (_amount >= premiumAtenDiscount[index].atenAmount)
        return premiumAtenDiscount[index].discount;
    }

    return
      _amount >= premiumAtenDiscount[0].atenAmount
        ? premiumAtenDiscount[0].discount
        : 0;
  }

  /// ============================ ///
  /// ========== COVERS ========== ///
  /// ============================ ///

  function deposit(
    uint256 amount,
    uint256 atenToStake,
    uint128[] calldata protocolIds
  ) public payable valideProtocolIds(protocolIds) {
    // retrieve user funds for coverage
    IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), amount);

    // check the user's balance of staked ATEN
    uint256 stakedAten = IStakedAten(stakedAtensGP).positionOf(msg.sender);

    // if user has staked ATEN then get discount
    uint128 stakingDiscount;
    if (stakedAten > 0) {
      stakingDiscount = getDiscountWithAten(stakedAten);
    }

    // deposit assets in the pool and create position NFT
    IPositionsManager(positionsManager).deposit(
      msg.sender,
      amount,
      stakingDiscount,
      atenToStake,
      protocolIds
    );
  }

  /*
  //Thao@TODO: not finit yet
  function updatePosition(
    uint256 tokenId,
    uint256 addingAmount,
    uint256 addingAtens
  ) public {
    //takeInterest ici ou plus tard ???
    IERC20(stablecoin).safeTransferFrom(
      msg.sender,
      address(this),
      addingAmount
    );
    IPositionsManager(positionsManager).updatePosition(
      msg.sender,
      tokenId,
      addingAmount,
      addingAtens
    );
  }
*/

  function takeInterest(uint256 tokenId, uint128 protocolId)
    public
    checkTokenOwner(tokenId)
  {
    IPositionsManager(positionsManager).takeInterest(
      msg.sender,
      tokenId,
      protocolId
    );
  }

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
      uint128 __discount
    ) = __positionManager.positions(__tokenId);

    actualizingProtocolAndRemoveExpiredPolicies(address(__protocol));

    (uint256 __newUserCapital, uint256 __aaveScaledBalanceToRemove) = __protocol
      .withdrawLiquidity(msg.sender, __userCapital, __protocolIds, __discount);

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

  function committingWithdrawAll(uint256 tokenId)
    external
    checkTokenOwner(tokenId)
  {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) > 0,
      "No position to commit withdraw"
    );

    uint256 _tokenId = IPositionsManager(positionsManager).tokenOfOwnerByIndex(
      msg.sender,
      0
    );

    IPositionsManager.Position memory __position = IPositionsManager(
      positionsManager
    ).position(_tokenId);

    for (uint256 index = 0; index < __position.protocolIds.length; index++)
      IProtocolPool(protocolsMapping[__position.protocolIds[index]].deployed)
        .committingWithdrawLiquidity(tokenId);
  }

  function withdrawAll(uint256 tokenId) external checkTokenOwner(tokenId) {
    IPositionsManager __positionsManager = IPositionsManager(positionsManager);

    IPositionsManager.Position memory __position = __positionsManager.position(
      tokenId
    );

    uint256 __newUserCapital;
    uint256 __aaveScaledBalanceToRemove;
    for (uint256 index = 0; index < __position.protocolIds.length; index++) {
      IProtocolPool __protocol = IProtocolPool(
        protocolsMapping[__position.protocolIds[index]].deployed
      );

      require(
        __protocol.isWithdrawLiquidityDelayOk(tokenId),
        "Withdraw reserve"
      );

      __protocol.removeCommittedWithdrawLiquidity(tokenId);

      actualizingProtocolAndRemoveExpiredPolicies(address(__protocol));

      (__newUserCapital, __aaveScaledBalanceToRemove) = __protocol
        .withdrawLiquidity(
          msg.sender,
          tokenId,
          __position.amountSupplied,
          __position.protocolIds,
          __position.discount
        );

      __protocol.removeLPInfo(tokenId);
    }

    __positionsManager.burn(tokenId);

    address __lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();

    uint256 _amountToWithdrawFromAAVE = __position.aaveScaledBalance.rayMul(
      ILendingPool(__lendingPool).getReserveNormalizedIncome(stablecoin)
    );

    ILendingPool(__lendingPool).withdraw(
      stablecoin,
      _amountToWithdrawFromAAVE,
      msg.sender
    );
  }

  /// ============================== ///
  /// ========== POLICIES ========== ///
  /// ============================== ///

  //////Thao@NOTE: Policy
  function buyPolicies(
    uint256[] calldata _amountCoveredArray,
    uint256[] calldata _paidPremiumArray,
    uint256[] calldata _atensLockedArray,
    uint128[] calldata _protocolIdArray
  ) public payable nonReentrant {
    for (uint256 i = 0; i < _protocolIdArray.length; i++) {
      uint256 _amountCovered = _amountCoveredArray[i];
      uint256 _paidPremium = _paidPremiumArray[i];
      uint256 _atensLocked = _atensLockedArray[i];
      uint128 _protocolId = _protocolIdArray[i];

      require(_amountCovered > 0 && _paidPremium > 0, "Must be greater than 0");

      IERC20(stablecoin).safeTransferFrom(
        msg.sender,
        protocolsMapping[_protocolId].deployed,
        _paidPremium
      );

      if (_atensLocked > 0) {
        //@dev TODO get oracle price !
        uint256 pricePrecision = 10000;
        uint256 __price = 100; // = 100 / 10.000 = 0.01 USDT
        uint256 __decimalsRatio = 10**18 / 10**ERC20(stablecoin).decimals();
        require(
          (__price * _atensLocked) / pricePrecision <=
            (_paidPremium * __decimalsRatio),
          "Too many ATENS"
        );

        IStakedAtenPolicy(stakedAtensPo).stake(msg.sender, _atensLocked);
      }

      uint256 __tokenId = IPolicyManager(policyManager).mint(
        msg.sender,
        _amountCovered,
        _paidPremium,
        _atensLocked,
        _protocolId
      );

      actualizingProtocolAndRemoveExpiredPolicies(
        protocolsMapping[_protocolId].deployed
      );

      IProtocolPool(protocolsMapping[_protocolId].deployed).buyPolicy(
        msg.sender,
        __tokenId,
        _paidPremium,
        _amountCovered
      );
    }
  }

  function withdrawPolicy(uint256 _policyId, uint256 _index)
    public
    payable
    nonReentrant
  {
    IPolicyManager policyManager_ = IPolicyManager(policyManager);
    IPolicyManager.Policy memory policy_ = policyManager_.checkAndGetPolicy(
      msg.sender,
      _policyId,
      _index
    );
    //Thao@Question: on fait quoi avec 'atensLocked' ???

    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[policy_.protocolId].deployed
    );

    require(policyManager_.balanceOf(msg.sender) > 0, "No Active Policy");

    uint256 remainedPremium_ = IProtocolPool(
      protocolsMapping[policy_.protocolId].deployed
    ).withdrawPolicy(msg.sender, policy_.amountCovered);

    policyManager_.saveExpiredPolicy(
      msg.sender,
      _policyId,
      policy_,
      policy_.paidPremium - remainedPremium_,
      true
    );

    policyManager_.burn(_policyId);
  }

  /// ============================ ///
  /// ========== CLAIMS ========== ///
  /// ============================ ///

  function startClaim(
    uint256 _policyId,
    uint256 _index,
    uint256 _amountClaimed
  ) external payable {
    require(_amountClaimed > 0, "Claimed amount is zero");

    IPolicyManager.Policy memory policy_ = IPolicyManager(policyManager)
      .checkAndGetPolicy(msg.sender, _policyId, _index);

    actualizingProtocolAndRemoveExpiredPolicies(
      protocolsMapping[policy_.protocolId].deployed
    );

    require(
      IPolicyManager(policyManager).balanceOf(msg.sender) > 0,
      "No Active Policy"
    );
    require(policy_.amountCovered >= _amountClaimed, "Too big claimed amount");

    IClaimManager(claimManager).claim{ value: msg.value }(
      msg.sender,
      _policyId,
      _amountClaimed
    );

    protocolsMapping[policy_.protocolId].claimsOngoing += 1;
  }

  //onlyClaimManager
  function resolveClaim(
    uint256 _policyId,
    uint256 _amount,
    address _account
  ) external override {
    require(
      _account == IPolicyManager(policyManager).ownerOf(_policyId),
      "Wrong account"
    );

    IPolicyManager.Policy memory policy_ = IPolicyManager(policyManager).policy(
      _policyId
    );

    IProtocolPool __protocolPool = IProtocolPool(
      protocolsMapping[policy_.protocolId].deployed
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
        .processClaim(policy_.protocolId, __ratio, __reserveNormalizedIncome);
    }

    ILendingPool(
      ILendingPoolAddressesProvider(aaveAddressesRegistry).getLendingPool()
    ).withdraw(stablecoin, _amount, _account);

    //Thao@TODO: enable next line when adding modifier 'onlyClaimManager' and calling startClaim to increment claimsOngoing before resolve
    // protocolsMapping[__protocolId].claimsOngoing -= 1;
  }

  /// ==================================== ///
  /// ========== PROTOCOL POOLS ========== ///
  /// ==================================== ///

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

  function pauseProtocol(uint128 protocolId, bool pause) external onlyOwner {
    protocolsMapping[protocolId].active = pause;
  }

  function getProtocols(uint128[] calldata protocolIds)
    external
    view
    returns (ProtocolView[] memory protocols)
  {
    protocols = new ProtocolView[](protocolIds.length);
    for (uint128 i = 0; i < protocolIds.length; i++) {
      (
        string memory name,
        uint256 totalCouvrageValue,
        uint256 availableCapacity,
        uint256 utilizationRate,
        uint256 premiumRate
      ) = IProtocolPool(protocolsMapping[protocolIds[i]].deployed)
          .protocolInfo();

      protocols[i] = ProtocolView(
        name,
        protocolIds[i],
        totalCouvrageValue,
        availableCapacity,
        utilizationRate,
        premiumRate
      );
    }
  }
}
