// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IPositionsManager.sol";
import "./interfaces/IProtocolFactory.sol";
import "./interfaces/IProtocolPool.sol";
import "./AAVE/ILendingPoolAddressesProvider.sol";
import "./AAVE/ILendingPool.sol";
import "./interfaces/IStakedAten.sol";
import "./interfaces/IPolicyManager.sol";
import "./interfaces/IScaledBalanceToken.sol";

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
  }

  mapping(uint128 => mapping(uint128 => bool)) public incompatibilityProtocols;
  mapping(uint128 => Protocol) public protocolsMapping;
  address public stablecoin;
  // AAVE lending pool
  address public aaveAddressesRegistry;
  address public positionsManager;
  address public policyManager;
  address public protocolFactory;

  address public stakedAtensGP;
  address public rewardsToken;
  address public aaveAtoken;

  uint8 private premiumDivisor;

  struct AtenDiscount {
    uint256 atenAmount;
    uint128 discount;
  }

  AtenDiscount[] public premiumAtenFees;

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
    address _protocolFactory
  ) external onlyOwner {
    positionsManager = _positionsAddress;
    stakedAtensGP = _stakedAtensGP;
    policyManager = _policyManagerAddress;
    aaveAtoken = _aaveAtoken;
    protocolFactory = _protocolFactory;
    approveLendingPool();
    //initialized = true; //@dev required ?
  }

  function buyPolicy(
    uint256 _amountGuaranteed,
    uint256 _premium,
    uint256 _atensLocked,
    uint128 _protocolId
  ) public payable nonReentrant {
    require(_amountGuaranteed > 0, "Amount must be greater than 0");
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
    IPolicyCover(protocolsMapping[_protocolId].deployed).buyPolicy(
      _premium,
      _amountGuaranteed
    );
  }

  function deposit(
    uint256 amount,
    uint256 atenToStake,
    uint128[] calldata _protocolIds,
    uint256[] calldata _amounts
  ) public payable nonReentrant {
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
    //@dev TODO stake atens and get corresponding discount
    _stakeAtens(atenToStake, amount);
    uint128 fees = getFeesWithAten(atenToStake);
    IPositionsManager(positionsManager).mint(
      msg.sender,
      fees,
      amount,
      _atokens,
      atenToStake,
      _protocolIds
    );
  }

  function withdrawAll() external {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) > 0,
      "No position to withdraw"
    );
    // uint256 amount = IPositionsManager(positionsManager).balanceOf(msg.sender);
    uint256 _tokenId = IPositionsManager(positionsManager).tokenOfOwnerByIndex(
      msg.sender,
      0
    );
    (
      uint256 liquidity,
      uint128[] memory protocolIds,
      uint256 atokens
    ) = IPositionsManager(positionsManager).positions(_tokenId);
    uint256[] memory amounts = new uint256[](protocolIds.length);
    for (uint256 index = 0; index < protocolIds.length; index++) {
      amounts[index] = liquidity;
    }
    // amounts[0] = uint256(0);
    _withdraw(amounts, protocolIds, atokens);
  }

  // @Dev TODO should add selected protocols & amounts to withdraw
  function withdraw(
    uint256[] memory _amounts,
    uint128[] memory protocolIds,
    uint256 atokens
  ) external {
    require(
      IPositionsManager(positionsManager).balanceOf(msg.sender) > 0,
      "No position to withdraw"
    );
    _withdraw(_amounts, protocolIds, atokens);
  }

  function _withdraw(
    uint256[] memory _amounts,
    uint128[] memory protocolIds,
    uint256 atokens
  ) internal {
    // uint256 amount = IPositionsManager(positionsManager).balanceOf(msg.sender);
    for (uint256 index = 0; index < protocolIds.length; index++) {
      // Claim rewards / update procotol positions then burn
      // IProtocolPool(protocolsMapping[protocolIds[index]].deployed).claim(
      //   msg.sender, _amounts[index]
      // );
      IProtocolPool(protocolsMapping[protocolIds[index]].deployed).withdraw(
        msg.sender,
        _amounts[index]
      );
    }
    // SHOULD Update if not max withdraw ?
    IPositionsManager(positionsManager).burn(msg.sender);
    _withdrawLiquidity(atokens);
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
      uint256 atokens
    ) = IPositionsManager(positionsManager).positions(tokenId);
    uint128 fees = getFeesWithAten(liquidity);
    uint256 actualAtens = IStakedAten(stakedAtensGP).balanceOf(msg.sender);
    require(actualAtens > 0, "No Atens to withdraw");
    // require(atenToWithdraw <= actualAtens, "Not enough Atens to withdraw");
    IStakedAten(stakedAtensGP).withdraw(msg.sender, atenToWithdraw);
    IPositionsManager(positionsManager).update(
      fees,
      liquidity,
      atokens,
      actualAtens - atenToWithdraw,
      protocolsId,
      tokenId
    );
  }

  function setFeesWithAten(AtenDiscount[] calldata _discountToSet)
    public
    onlyOwner
  {
    for (uint256 index = 0; index < _discountToSet.length; index++) {
      premiumAtenFees.push(_discountToSet[index]);
    }
  }

  function getFeesWithAten(uint256 _amount) public view returns (uint128) {
    for (uint256 index = 0; index < premiumAtenFees.length; index++) {
      if (_amount < premiumAtenFees[index].atenAmount)
        return index == 0 ? 0 : premiumAtenFees[index - 1].discount;
    }
    // Else we are above max discount, so give it max discount
    return premiumAtenFees[premiumAtenFees.length - 1].discount;
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

  function _withdrawLiquidity(uint256 _atokens) internal {
    //@dev TODO Transfer from AAVE, burn LP
    address lendingPool = ILendingPoolAddressesProvider(aaveAddressesRegistry)
      .getLendingPool();
    uint256 _amountToWithdraw = (_atokens *
      IERC20(aaveAtoken).balanceOf(address(this))) /
      IScaledBalanceToken(aaveAtoken).scaledBalanceOf(address(this));
    // No need to transfer Stable, lending pool will do it
    ILendingPool(lendingPool).withdraw(
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
      .deployProtocol(name, stablecoin, newProtocolId);
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
      active: true
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
