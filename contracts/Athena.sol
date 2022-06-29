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
import "./interfaces/IPolicyManager.sol";
import "./interfaces/IScaledBalanceToken.sol";
import "./interfaces/IClaimManager.sol";

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
  address public rewardsToken;
  address public aaveAtoken;

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

  //Thao@TODO: can we use delegateCall here ?
  //Thao@NOTE: for testing
  function addClaim(
    address _account,
    uint128 _protocolId,
    uint256 _amount
  ) public nonReentrant {
    IProtocolPool __protocolPool = IProtocolPool(
      protocolsMapping[_protocolId].deployed
    );

    ClaimCover.Claim memory __newClaim = __protocolPool.buildClaim(_amount);
    uint128[] memory __relatedProtocols = __protocolPool.getRelatedProtocols();

    for (uint256 i = 0; i < __relatedProtocols.length; i++) {
      IProtocolPool(protocolsMapping[__relatedProtocols[i]].deployed).addClaim(
        _account,
        __newClaim
      );
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

  function resolveClaim(
    uint256 _policyId,
    uint256 _amount,
    address _account,
    uint256 _index
  ) external {
    require(
      msg.sender == claimManager,
      "Only Claim Manager can resolve claims"
    );
    (, uint128 __protocolId, address _accountConfirm) = IPolicyManager(
      policyManager
    ).policies(_policyId);
    console.log("Account : ", _account);
    console.log("Policy Id : ", _policyId);
    console.log("Account confirm : ", _accountConfirm);
    require(_account == _accountConfirm, "Wrong account");
    protocolsMapping[__protocolId].claimsOngoing -= 1;
    if (_amount > 0) {
      IProtocolPool(protocolsMapping[__protocolId].deployed).releaseFunds(
        _account,
        _amount
      );
    }
  }

  //Thao@TODO: il faut add relatedProtocol
  function deposit(
    uint256 amount,
    uint256 atenToStake,
    uint128[] calldata _protocolIds,
    uint256[] calldata _amounts
  ) public payable {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) == 0,
      "Already have a position"
    );
    require(
      _protocolIds.length == _amounts.length,
      "Invalid deposit protocol length"
    );
    for (uint256 index = 0; index < _protocolIds.length; index++) {
      require(
        protocolsMapping[_protocolIds[index]].active == true,
        "Protocol not active"
      );
      for (uint256 index2 = index + 1; index2 < _protocolIds.length; index2++) {
        //@Dev TODO WARNING issue here with protocols inverted ??
        require(
          incompatibilityProtocols[_protocolIds[index2]][_protocolIds[index]] ==
            false &&
            incompatibilityProtocols[_protocolIds[index]][
              _protocolIds[index2]
            ] ==
            false,
          "Protocol not compatible"
        );
      }
      require(
        _amounts[index] <= amount,
        "Protocol amount must be less than deposit amount"
      );
      IProtocolPool(protocolsMapping[_protocolIds[index]].deployed).mint(
        msg.sender,
        _amounts[index]
      );
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
      uint256 createdAt
    ) = IPositionsManager(positionsManager).positions(_tokenId);
    // amounts[0] = uint256(0);
    _withdraw(liquidity, protocolIds, atokens, discount, createdAt);
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
    _withdraw(_amount, _protocolIds, _atokens, 0, 0);
  }

  function _withdraw(
    uint256 _amount,
    uint128[] memory _protocolIds,
    uint256 _atokens,
    uint128 _discount,
    uint256 createdAt
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
      ).withdrawLiquidity(msg.sender, _amount, _discount, createdAt);

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

  function pauseProtocol(uint128 protocolId, bool pause) external onlyOwner {
    protocolsMapping[protocolId].active = pause;
  }
}
