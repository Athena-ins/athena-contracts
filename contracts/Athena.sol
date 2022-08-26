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

import "./ClaimCover.sol";

import "hardhat/console.sol";

contract Athena is ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  uint256 internal constant MAX_UINT256 = 2**256 - 1;
  struct Protocol {
    //id in mapping
    uint128 id;
    //Protocol Pool Address deployed
    address deployed;
    //Protocol name
    string name;
    //address for the protocol interface to be unique
    address protocolAddress;
    //Premium rate to pay for this protocol
    uint8 premiumRate;
    //Protocol guarantee type, could be 0 = smart contract vuln, 1 = unpeg, 2 = rug pull ...
    uint8 guarantee;
    //is Active or paused
    bool active;
    // claim ongoing, lock funds when claim is ongoing
    uint128 claimsOngoing;
  }

  mapping(uint128 => mapping(uint128 => bool)) public incompatibilityProtocols;
  mapping(uint128 => Protocol) public protocolsMapping;
  address public stablecoin;
  // AAVE lending pool
  address public aaveAddressesRegistry;
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

  uint8 private premiumDivisor;

  struct AtenDiscount {
    uint256 atenAmount;
    uint128 discount;
  }

  AtenDiscount[] public premiumAtenDiscount;

  uint128[] public protocols;

  event NewProtocol(uint128);
  event AddGuarantee(
    address indexed from,
    uint256 capital,
    uint128[] protocolIds
  );

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
    //@dev TODO get rate for price and durationw
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
    IPolicyManager(policyManager).mint(
      msg.sender,
      _amountGuaranteed,
      _atensLocked,
      _protocolId
    );
    IProtocolPool(protocolsMapping[_protocolId].deployed).buyPolicy(
      msg.sender,
      _premium,
      _amountGuaranteed
    );
  }

  //Thao@TODO: à compléter
  function withdrawPolicy(uint128 _protocolId) public payable nonReentrant {
    IProtocolPool(protocolsMapping[_protocolId].deployed).withdrawPolicy(
      msg.sender
    );
  }

  //Thao@NOTE: for testing
  function addClaim(
    uint128 _protocolId,
    address _account,
    uint256 _amount
  ) public nonReentrant {
    //Thao@TODO: avant de ajouter claim, il faut vérifier dans protocolId s'il account existe
    IProtocolPool __protocolPool = IProtocolPool(
      protocolsMapping[_protocolId].deployed
    );

    uint256 ratio = __protocolPool.releaseFunds(_account, _amount);
    uint128[] memory __relatedProtocols = __protocolPool.getRelatedProtocols();

    for (uint256 i = 0; i < __relatedProtocols.length; i++) {
      if (__relatedProtocols[i] != _protocolId)
        IProtocolPool(protocolsMapping[__relatedProtocols[i]].deployed)
          .processClaim(_protocolId, ratio);
    }
  }

  function startClaim(
    uint256 _policyId,
    uint256 _index,
    uint256 _amountClaimed
  ) external payable {
    uint256 _policies = IPolicyManager(policyManager).balanceOf(msg.sender);
    require(_policies > 0, "No Active Policy");

    require(
      _policyId ==
        IPolicyManager(policyManager).tokenOfOwnerByIndex(msg.sender, _index),
      "Wrong Token Id for Policy"
    );
    (, uint128 __protocolId, address _owner) = IPolicyManager(policyManager)
      .policies(_policyId);
    require(_owner == msg.sender, "Policy is not owned");

    //@Dev TODO require not expired Policy
    // require(
    //   IProtocolPool(positionsManager).isActive(
    //     msg.sender,
    //     _policyId
    //   ),
    //   "Policy Not active"
    // );
    protocolsMapping[__protocolId].claimsOngoing += 1;
    IClaimManager(claimManager).claim{ value: msg.value }(
      msg.sender,
      _policyId,
      _amountClaimed
    );
  }

  modifier onlyClaimManager() {
    require(msg.sender == claimManager, "Only Claim Manager");
    _;
  }

  //TODO: call releaseFunds fct in __protocolId and add claim to __relatedProtocols
  function resolveClaim(
    uint256 _policyId,
    uint256 _amount,
    address _account,
    uint256 _index
  ) external onlyClaimManager {
    (, uint128 __protocolId, address _accountConfirm) = IPolicyManager(
      policyManager
    ).policies(_policyId);
    console.log("Account : ", _account);
    console.log("Policy Id : ", _policyId);
    console.log("Account confirm : ", _accountConfirm);
    require(_account == _accountConfirm, "Wrong account");
    protocolsMapping[__protocolId].claimsOngoing -= 1;
    //TODO: we don't need this condition here, we need to check before the vote
    if (_amount > 0) {
      //calcul claim for all protocols
      IProtocolPool __protocolPool = IProtocolPool(
        protocolsMapping[__protocolId].deployed
      );

      //   ClaimCover.Claim memory __newClaim = __protocolPool.buildClaim(_amount);
      //   uint128[] memory __relatedProtocols = __protocolPool
      //     .getRelatedProtocols();

      //   for (uint256 i = 0; i < __relatedProtocols.length; i++) {
      //     IProtocolPool(protocolsMapping[__relatedProtocols[i]].deployed)
      //       .addClaim(__newClaim);
      //   }

      //   //transfer token
      //   IProtocolPool(protocolsMapping[__protocolId].deployed).releaseFunds(
      //     _account,
      //     _amount
      //   );
    }
  }

  function deposit(
    uint256 amount,
    uint256 atenToStake,
    uint128[] calldata _protocolIds
  ) public payable {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) == 0,
      "Already have a position"
    );

    for (uint256 index = 0; index < _protocolIds.length; index++) {
      Protocol memory protocol1 = protocolsMapping[_protocolIds[index]];
      IProtocolPool protocolPool1 = IProtocolPool(protocol1.deployed);

      require(protocol1.active == true, "Protocol not active");

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

      protocolPool1.mint(msg.sender, amount);
      protocolPool1.addRelatedProtocol(_protocolIds[index], amount);
    }

    uint256 _atokens = _transferLiquidity(amount);
    uint128 _discount = 0;
    if (atenToStake > 0) {
      _stakeAtens(atenToStake, amount);
      _discount = getDiscountWithAten(atenToStake);
    }

    IPositionsManager(positionsManager).mint(
      msg.sender,
      _discount,
      amount,
      _atokens,
      atenToStake,
      _protocolIds
    );
  }

  function committingWithdrawAll() external {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) > 0,
      "No position to commit withdraw"
    );

    uint256 _tokenId = IPositionsManager(positionsManager).tokenOfOwnerByIndex(
      msg.sender,
      0
    );
    (, uint128[] memory _protocolIds, , , ) = IPositionsManager(
      positionsManager
    ).positions(_tokenId);

    for (uint256 index = 0; index < _protocolIds.length; index++)
      IProtocolPool(protocolsMapping[_protocolIds[index]].deployed)
        .committingWithdrawLiquidity(msg.sender);
  }

  function withdrawAll() external {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) > 0,
      "No position to withdraw"
    );
    // uint256 amount = IPositionsManager(positionsManager).balanceOf(msg.sender);
    // removed because only one position is allowed in protocol
    uint256 _tokenId = IPositionsManager(positionsManager).tokenOfOwnerByIndex(
      msg.sender,
      0
    );
    (
      uint256 liquidity,
      uint128[] memory protocolIds,
      uint256 atokens,
      uint128 discount,

    ) = IPositionsManager(positionsManager).positions(_tokenId);
    // amounts[0] = uint256(0);
    _withdraw(liquidity, protocolIds, atokens, discount);
    for (uint256 index = 0; index < protocolIds.length; index++) {
      IProtocolPool(protocolsMapping[protocolIds[index]].deployed)
        .removeCommittedWithdrawLiquidity(msg.sender);
    }
  }

  // @Dev TODO should add selected protocols & amounts to withdraw
  function withdraw(
    uint256 _amount,
    uint128[] memory _protocolIds,
    uint256 _atokens
  ) external {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) > 0,
      "No position to withdraw"
    );
    _withdraw(_amount, _protocolIds, _atokens, 0);
  }

  function _withdraw(
    uint256 _amount,
    uint128[] memory _protocolIds,
    uint256 _atokens,
    uint128 _discount
  ) internal {
    // uint256 amount = IPositionsManager(positionsManager).balanceOf(msg.sender);
    uint256 __claimedAmount;
    for (uint256 index = 0; index < _protocolIds.length; index++) {
      require(
        protocolsMapping[_protocolIds[index]].active == true,
        "Protocol not active"
      );
      require(
        protocolsMapping[_protocolIds[index]].claimsOngoing == 0,
        "Protocol locked"
      );

      uint256 _maxCapital = IProtocolPool(
        protocolsMapping[_protocolIds[index]].deployed
      ).withdrawLiquidity(msg.sender, _amount, _protocolIds, _discount);

      if (_maxCapital < _amount) __claimedAmount += _amount - _maxCapital;
    }
    // SHOULD Update if not max withdraw ?
    IPositionsManager(positionsManager).burn(msg.sender);
    _withdrawLiquidity(_atokens, _amount - __claimedAmount);
  }

  function _stakeAtens(uint256 atenToStake, uint256 amount) internal {
    IStakedAten(stakedAtensGP).stake(msg.sender, atenToStake, amount);
  }

  function withdrawAtens(uint256 atenToWithdraw) external {
    //@dev TODO check if multiple NFT positions
    uint256 tokenId = IPositionsManager(positionsManager).tokenOfOwnerByIndex(
      msg.sender,
      0
    );
    (
      uint256 liquidity,
      uint128[] memory protocolsId,
      uint256 atokens,
      ,

    ) = IPositionsManager(positionsManager).positions(tokenId);
    uint128 _discount = getDiscountWithAten(liquidity);
    uint256 actualAtens = IStakedAten(stakedAtensGP).balanceOf(msg.sender);
    require(actualAtens > 0, "No Atens to withdraw");
    // require(atenToWithdraw <= actualAtens, "Not enough Atens to withdraw");
    IStakedAten(stakedAtensGP).withdraw(msg.sender, atenToWithdraw);
    IPositionsManager(positionsManager).update(
      _discount,
      liquidity,
      atokens,
      actualAtens - atenToWithdraw,
      protocolsId,
      tokenId
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

  function approveLendingPool() internal {
    IERC20(stablecoin).safeApprove(
      ILendingPoolAddressesProvider(aaveAddressesRegistry).getLendingPool(),
      MAX_UINT256
    );
  }

  function _transferLiquidity(uint256 _amount) internal returns (uint256) {
    uint256 balAtoken = IScaledBalanceToken(aaveAtoken).scaledBalanceOf(
      address(this)
    );
    IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), _amount);
    address lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();
    ILendingPool(lendingPool).deposit(stablecoin, _amount, address(this), 0);
    uint256 balAtokenAfter = IScaledBalanceToken(aaveAtoken).scaledBalanceOf(
      address(this)
    );
    return balAtokenAfter - balAtoken;
  }

  function _withdrawLiquidity(uint256 _atokens, uint256 _claimedAmount)
    internal
  {
    //@dev TODO Transfer from AAVE, burn LP
    address _lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();
    uint256 _amountToWithdraw = (_atokens *
      IERC20(aaveAtoken).balanceOf(address(this))) /
      IScaledBalanceToken(aaveAtoken).scaledBalanceOf(address(this)) -
      _claimedAmount;
    // No need to transfer Stable, lending pool will do it
    ILendingPool(_lendingPool).withdraw(
      stablecoin,
      _amountToWithdraw,
      msg.sender
    );
  }

  function addNewProtocol(
    string calldata name,
    uint8 guaranteeType,
    uint8 premium,
    address iface,
    uint128[] calldata protocolsNotCompat
  ) public onlyOwner {
    uint128 newProtocolId = uint128(protocols.length);
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
    // ProtocolPool _protocolDeployed = new ProtocolPool(
    //   address(this),
    //   rewardsToken,
    //   name,
    //   // A P P = Athena Protocol Pool
    //   string(abi.encodePacked("APP_", Strings.toString(newProtocolId)))
    // );
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
    protocols.push(newProtocolId);
    emit NewProtocol(newProtocolId);
  }

  function protocolsLength() external view returns (uint256) {
    return protocols.length;
  }

  function pauseProtocol(uint128 protocolId, bool pause) external onlyOwner {
    protocolsMapping[protocolId].active = pause;
  }
}
