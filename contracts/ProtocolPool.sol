// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IProtocolPool.sol";
import "./PolicyCover.sol";

contract ProtocolPool is IProtocolPool, PolicyCover {
  using RayMath for uint256;
  using SafeERC20 for IERC20;

  struct LPInfo {
    uint256 beginLiquidityIndex;
    uint256 beginClaimIndex; //when a LP enter in pool, save the length of claims
  }

  address private immutable core;
  address public underlyingAsset;
  uint128 public id;
  uint256 public immutable commitDelay;

  mapping(address => uint256) public withdrawReserves;
  mapping(address => LPInfo) public LPsInfo;

  // @Dev notice rule
  // external and public functions should use Decimals and convert to RAY, other functions should already use RAY
  // external function onlyCore convert afterwards to user public view functions

  //@dev constructs Pool LP Tokens, decimals defaults to 18
  constructor(
    address _core,
    address _underlyingAsset,
    uint128 _id,
    uint256 _uOptimal,
    uint256 _r0,
    uint256 _rSlope1,
    uint256 _rSlope2,
    string memory _name,
    string memory _symbol,
    uint256 _commitDelay
  ) ERC20(_name, _symbol) PolicyCover(_uOptimal, _r0, _rSlope1, _rSlope2) {
    core = _core;
    underlyingAsset = _underlyingAsset;
    commitDelay = _commitDelay;
    id = _id;
    relatedProtocols.push(_id);
    // intersectingAmountIndexes[_id] = 0;
    intersectingAmounts.push();
  }

  modifier onlyCore() {
    require(msg.sender == core, "Only Core");
    _;
  }

  function getRelatedProtocols()
    external
    view
    override
    returns (uint128[] memory)
  {
    return relatedProtocols;
  }

  function addRelatedProtocol(uint128 _protocolId, uint256 _amount)
    external
    onlyCore
  {
    if (intersectingAmountIndexes[_protocolId] == 0 && _protocolId != id) {
      intersectingAmountIndexes[_protocolId] = intersectingAmounts.length;

      relatedProtocols.push(_protocolId);

      intersectingAmounts.push();
    }

    intersectingAmounts[intersectingAmountIndexes[_protocolId]] += _amount;
  }

  function committingWithdrawLiquidity(address _account) external onlyCore {
    withdrawReserves[_account] = block.timestamp;
  }

  function removeCommittedWithdrawLiquidity(address _account) external {
    delete withdrawReserves[_account];
  }

  function mint(address _account, uint256 _amount) external onlyCore {
    _actualizing();

    _updateSlot0WhenAvailableCapitalChange(_amount, 0);
    availableCapital += _amount;
    _mint(_account, _amount);
    LPsInfo[_account] = LPInfo(liquidityIndex, claims.length);

    emit Mint(_account, _amount);
  }

  function buyPolicy(
    address _owner,
    uint256 _premium,
    uint256 _insuredCapital
  ) external onlyCore notExistedOwner(_owner) {
    _actualizing();
    _buyPolicy(_owner, _premium, _insuredCapital);

    emit BuyPolicy(_owner, _premium, _insuredCapital);
  }

  function withdrawPolicy(address _owner)
    external
    onlyCore
    existedOwner(_owner)
  {
    _actualizing();
    uint256 __remainedPremium = _withdrawPolicy(_owner);

    emit WithdrawPolicy(_owner, __remainedPremium);
  }

  function _getLPInfoUntil(
    address _account,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _dateInSecond
  )
    public
    view
    returns (
      uint256 __finalUserCapital,
      uint256 __totalRewards,
      LPInfo memory __lpInfo
    )
  {
    __lpInfo = LPsInfo[_account];
    Claim[] memory __claims = _claims(__lpInfo.beginClaimIndex);

    __finalUserCapital = _userCapital;

    for (uint256 i = 0; i < __claims.length; i++) {
      Claim memory __claim = __claims[i];

      __totalRewards += __finalUserCapital.rayMul(
        __claim.liquidityIndexBeforeClaim - __lpInfo.beginLiquidityIndex
      );

      for (uint256 j = 0; j < _protocolIds.length; j++) {
        if (_protocolIds[j] == __claim.fromProtocolId) {
          uint256 __userCapitalToRemove = __finalUserCapital.rayMul(
            __claim.ratio
          );
          __finalUserCapital -= __userCapitalToRemove;

          //or: __finalUserCapital = __finalUserCapital.rayMul(RayMath.RAY - __claim.ratio);
          break;
        }
      }

      __lpInfo.beginLiquidityIndex = __claim.liquidityIndexBeforeClaim;
    }

    uint256 __liquidityIndex;

    if (slot0.remainingPolicies > 0) {
      (, __liquidityIndex) = _actualizingUntil(_dateInSecond);
    } else {
      __liquidityIndex = liquidityIndex;
    }

    __totalRewards += __finalUserCapital.rayMul(
      __liquidityIndex - __lpInfo.beginLiquidityIndex
    );

    __lpInfo.beginLiquidityIndex = __liquidityIndex;
    __lpInfo.beginClaimIndex += __claims.length;
  }

  function rewardsOf(
    address _account,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _discount
  ) public view returns (uint256 totalRewards) {
    (, uint256 __totalRewards, ) = _getLPInfoUntil(
      _account,
      _userCapital,
      _protocolIds,
      block.timestamp
    );

    return (__totalRewards * (1000 - _discount)) / 1000;
  }

  event TakeInterest(
    address account,
    uint256 userCapital,
    uint256 rewardsGross,
    uint256 rewardsNet,
    uint256 fee
  );

  function takeInterest(
    address _account,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint256 _discount
  ) public onlyCore returns (uint256) {
    (
      uint256 __newUserCapital,
      uint256 __totalRewards,
      LPInfo memory __lpInfo
    ) = _getLPInfoUntil(_account, _userCapital, _protocolIds, block.timestamp);

    //transfer to account:
    uint256 __interestNet = (__totalRewards * (1000 - _discount)) / 1000;

    //transfer to treasury
    uint256 __fee = __totalRewards - __interestNet;

    LPsInfo[_account] = __lpInfo;

    emit TakeInterest(
      _account,
      __newUserCapital,
      __totalRewards,
      __interestNet,
      __fee
    );
    return __newUserCapital;
  }

  //Thao@TODO: need to test
  function withdrawLiquidity(
    address _account,
    uint256 _userCapital,
    uint128[] calldata _protocolIds,
    uint128 _discount
  ) external override onlyCore returns (uint256 totalRewards) {
    require(
      withdrawReserves[_account] != 0 &&
        block.timestamp - withdrawReserves[_account] >= commitDelay,
      "withdraw reserve"
    );

    require(
      _utilisationRate(
        0,
        0,
        slot0.totalInsuredCapital,
        availableCapital - _userCapital
      ) <= RayMath.RAY * 100,
      string(abi.encodePacked(name(), ": use rate > 100%"))
    );

    (uint256 __finalUserCapital, uint256 __totalRewards, ) = _getLPInfoUntil(
      _account,
      _userCapital,
      _protocolIds,
      block.timestamp
    );

    _burn(_account, balanceOf(_account));
    //or: _burn(_account, _userCapital);
    if (__totalRewards > 0) {
      IERC20(underlyingAsset).safeTransfer(
        _account,
        (__totalRewards * (1000 - _discount)) / 1000
      );

      _transferToTreasury((uint256(__totalRewards) * _discount) / 1000);
    }

    _updateSlot0WhenAvailableCapitalChange(0, __finalUserCapital);

    availableCapital -= __finalUserCapital;

    for (uint256 i = 0; i < _protocolIds.length; i++) {
      intersectingAmounts[
        intersectingAmountIndexes[_protocolIds[i]]
      ] -= __finalUserCapital;
    }

    return __finalUserCapital + ((__totalRewards * (1000 - _discount)) / 1000);
  }

  function _transferToTreasury(uint256 _amount) internal {
    IERC20(underlyingAsset).safeTransfer(core, _amount);
  }

  function processClaim(uint128 _fromProtocolId, uint256 _ratio)
    public
    override
  {
    _actualizing();

    uint256 __amountToRemoveByClaim = _amountToRemoveFromIntersecAndCapital(
      _intersectingAmount(_fromProtocolId),
      _ratio
    );
    _updateSlot0WhenAvailableCapitalChange(0, __amountToRemoveByClaim);
    availableCapital -= __amountToRemoveByClaim;
    intersectingAmounts[
      intersectingAmountIndexes[_fromProtocolId]
    ] -= __amountToRemoveByClaim;
    claims.push(Claim(_fromProtocolId, _ratio, liquidityIndex));
  }

  event ReleaseFunds(address account, uint256 amount);

  //Thao@TODO:somethings missing  or not???
  function releaseFunds(address _account, uint256 _amount)
    external
    override
    onlyCore
    returns (uint256 ratio)
  {
    ratio = _amount.rayDiv(availableCapital);
    processClaim(id, ratio);

    console.log("Amount to refund : ", _amount);
    uint256 bal = IERC20(underlyingAsset).balanceOf(address(this));
    console.log("Balance Contract = ", bal);
    console.log("Account to transfer = ", _account);
    // IERC20(underlyingAsset).safeTransfer(_account, _amount);
    emit ReleaseFunds(_account, _amount);
  }

  //Thao@NOTE: for testing
  function actualizingTest() external {
    _actualizing();
  }
}
