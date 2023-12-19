// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

// contracts
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// libraries
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { RayMath } from "../libs/RayMath.sol";

// interfaces
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IStrategy {
  // function isAthenaStrategy() external view returns (bool);
  // function isPaused() external view returns (bool);
  // function name() external view returns (string memory);
  // function initialize() external returns (bool);
  // function deposit(uint256 _amount) external;
  // function withdraw(uint256 _amount) external;
  // function balanceOf() external view returns (uint256);
  // function harvest() external;
  // function token() external view returns (address);
}

contract AthenaAaveV2UsdtStrategy is IStrategy {
  using RayMath for uint256;

  string public constant name = "Athena: AAVE v2 USDT";
  bool public isAthenaStrategy = true;
  bool public isPaused;

  address depositContract =
    0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3;
  address underlyingAsset =
    0xdAC17F958D2ee523a2206206994597C13D831ec7;
  address liquidityAsset = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;

  function initialize() external returns (bool) {}

  function preDepositHook(uint256 _amount) external {}

  function deposit(uint256 _amountUnderlying) external {
    // ILendingPool(lendingPool).deposit(
    //   token_,
    //   amount_,
    //   address(this),
    //   0
    // );
    // normalizedIncome = amount_.rayDiv(
    //   ILendingPool(lendingPool).getReserveNormalizedIncome(token_)
    // );
  }

  function preWithdrawHook(uint256 _amount) external {}

  function withdraw(uint256 _amountUnderlying) external {}

  function balanceOfUnderlying() external view returns (uint256) {}

  function harvest() external {}
}

//======== ERRORS ========//

// Not a valid strategy
error NotAValidStrategy();

contract StrategyManager is Ownable {
  using SafeERC20 for IERC20;

  uint256 public nextStrategyId;
  mapping(uint256 strategyId => IStrategy implementation)
    public strategies;

  constructor() Ownable(msg.sender) {}

  function addStrategy(address _strategy) external onlyOwner {
    IStrategy strategy = IStrategy(_strategy);

    // strategy.initialize();

    strategies[nextStrategyId] = strategy;
    nextStrategyId++;
  }

  function deposit(
    uint256 _strategyId,
    uint256 _amountUnderlying
  ) external {
    // IStrategy strategy = strategies[_strategyId];
    // return
    //   strategy.delegatecall(
    //     abi.encodeWithSelector(
    //       IStrategy.deposit.selector,
    //       _amountUnderlying
    //     )
    //   );
  }

  function withdraw(
    uint256 _strategyId,
    uint256 _amountUnderlying
  ) external {
    // IStrategy strategy = strategies[_strategyId];
    // return
    //   strategy.delegatecall(
    //     abi.encodeWithSelector(
    //       IStrategy.withdraw.selector,
    //       _amountUnderlying
    //     )
    //   );
  }
}
