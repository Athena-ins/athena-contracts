// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IInceptionToken {
  event VaultChanged(address prevValue, address newValue);

  event Paused(address account);
  event Unpaused(address account);

  function mint(address account, uint256 amount) external;

  function burn(address account, uint256 amount) external;
}

interface IInceptionVault_S {
  /*///////////////////
    ////// Events //////
    /////////////////*/

  event Deposit(
    address indexed sender,
    address indexed receiver,
    uint256 amount,
    uint256 iShares
  );

  event Withdraw(
    address indexed sender,
    address indexed receiver,
    address indexed owner,
    uint256 amount,
    uint256 iShares
  );

  event FlashWithdraw(
    address indexed sender,
    address indexed receiver,
    address indexed owner,
    uint256 amount,
    uint256 iShares,
    uint256 fee
  );

  event Redeem(
    address indexed sender,
    address indexed receiver,
    uint256 amount
  );

  event RedeemedRequests(uint256[] withdrawals);

  event OperatorChanged(address prevValue, address newValue);

  event WithdrawMinAmountChanged(uint256 prevValue, uint256 newValue);

  event DepositMinAmountChanged(uint256 prevValue, uint256 newValue);

  event FlashMinAmountChanged(uint256 prevValue, uint256 newValue);

  event RatioFeedChanged(address prevValue, address newValue);

  event NameChanged(string prevValue, string newValue);

  event TreasuryChanged(address prevValue, address newValue);

  event MellowRestakerChanged(address prevValue, address newValue);

  event ReferralCode(bytes32 indexed code);

  event DepositBonus(uint256 amount);

  event DepositBonusParamsChanged(
    uint256 newMaxBonusRate,
    uint256 newOptimalBonusRate,
    uint256 newDepositUtilizationKink
  );

  event WithdrawFeeParamsChanged(
    uint256 newMaxFlashFeeRate,
    uint256 newOptimalWithdrawalRate,
    uint256 newWithdrawUtilizationKink
  );

  event ProtocolFeeChanged(uint256 prevValue, uint256 newValue);

  event WithdrawalFee(uint256 indexed fee);

  function inceptionToken() external view returns (IInceptionToken);

  function ratio() external view returns (uint256);
}
