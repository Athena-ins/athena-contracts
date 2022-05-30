// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8;

/**
 * @title RayMath library
 * @author Aave
 * @dev Provides mul and div function for wads (decimal numbers with 18 digits precision) and rays (decimals with 27 digits)
 **/

library WadRayMath {
  uint256 internal constant RAY = 1e27;
  uint256 internal constant halfRAY = RAY / 2;

  /**
   * @return One ray, 1e27
   **/
  function ray() internal pure returns (uint256) {
    return RAY;
  }

  /**
   * @return Half ray, 1e27/2
   **/
  function halfRay() internal pure returns (uint256) {
    return halfRAY;
  }

  /**
   * @dev Multiplies two ray, rounding half up to the nearest ray
   * @param a Ray
   * @param b Ray
   * @return The result of a*b, in ray
   **/
  function rayMul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0 || b == 0) {
      return 0;
    }

    require(a <= (type(uint256).max - halfRAY) / b, "Overflow in rayMul");

    return (a * b + halfRAY) / RAY;
  }

  function rayMulRoundingDown(uint256 a, uint256 b)
    internal
    pure
    returns (uint256)
  {
    if (a == 0 || b == 0) {
      return 0;
    }

    require(a <= type(uint256).max / b, "Overflow in rayMul");

    return (a * b) / RAY;
  }

  /**
   * @dev Divides two ray, rounding half up to the nearest ray
   * @param a Ray
   * @param b Ray
   * @return The result of a/b, in ray
   **/
  function rayDiv(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, "Division by zero");
    uint256 halfB = b / 2;

    require(a <= (type(uint256).max - halfB) / RAY, "Overflow in rayDiv");

    return (a * RAY + halfB) / b;
  }

  function rayDivRoundingDown(uint256 a, uint256 b)
    internal
    pure
    returns (uint256)
  {
    require(b != 0, "Division by zero");

    require(a <= type(uint256).max / RAY, "Overflow in rayDiv");

    return (a * RAY) / b;
  }
}
