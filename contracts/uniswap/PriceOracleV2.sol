// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./IUniswapV3Pool.sol";
import "./TickMath.sol";
import "./FixedPoint96.sol";
import "./FullMath.sol";

contract PriceOracleV2 is Ownable {
  IUniswapV3Pool public uniswapV3PoolInterface;
  address public atenToken;
  address public usdtToken;
  bool public usdtIsToken1;

  constructor(
    address atenUsdtPoolAddress,
    address atenToken_,
    address usdtToken_
  ) {
    uniswapV3PoolInterface = IUniswapV3Pool(atenUsdtPoolAddress);

    atenToken = atenToken_;
    usdtToken = usdtToken_;

    if (atenToken_ < usdtToken_) {
      usdtIsToken1 = true;
    } else {
      usdtIsToken1 = false;
    }
  }

  function updatePoolAddress(address atenUsdtPoolAddress) external onlyOwner {
    uniswapV3PoolInterface = IUniswapV3Pool(atenUsdtPoolAddress);
  }

  function setPoolObservationRange(uint16 nbObservations) external onlyOwner {
    uniswapV3PoolInterface.increaseObservationCardinalityNext(nbObservations);
  }

  function getSqrtTwapX96(
    uint32 twapInterval
  ) public view returns (uint160 sqrtPriceX96) {
    if (twapInterval == 0) {
      // return the current price if twapInterval == 0
      (sqrtPriceX96, , , , , , ) = uniswapV3PoolInterface.slot0();
    } else {
      uint32[] memory secondsAgos = new uint32[](2);
      secondsAgos[0] = twapInterval; // from (before)
      secondsAgos[1] = 0; // to (now)

      (int56[] memory tickCumulatives, ) = uniswapV3PoolInterface.observe(
        secondsAgos
      );

      // tick(imprecise as it's an integer) to price
      sqrtPriceX96 = TickMath.getSqrtRatioAtTick(
        int24(
          (tickCumulatives[1] - tickCumulatives[0]) /
            int56(uint56(twapInterval))
        )
      );
    }
  }

  function getPriceX96FromSqrtPriceX96(
    uint160 sqrtPriceX96
  ) public pure returns (uint256 priceX96) {
    return FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, FixedPoint96.Q96);
  }

  /// @dev returns the amount of token1 equal to one token0
  // The price is equal to 1.0001^priceX96
  // The re
  function getAtenPrice() external view returns (uint256) {
    uint32 twapInterval = 1; // Should always be max
    uint160 sqrtPriceX96 = getSqrtTwapX96(twapInterval);
    uint256 priceX96 = getPriceX96FromSqrtPriceX96(sqrtPriceX96);

    // @bw Notes for future implementation:
    // need to transform price to be able to consume efficiently on-chain
    // need to set and check token1 so price is given in ATEN per USDT
    return priceX96;
  }
}
