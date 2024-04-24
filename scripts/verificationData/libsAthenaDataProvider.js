const { getNetworkAddresses } = require("./addresses");

const { PoolMath, VirtualPool } = getNetworkAddresses();

module.exports = {
  ["src/libs/PoolMath.sol:PoolMath"]: PoolMath,
  ["src/libs/VirtualPool.sol:VirtualPool"]: VirtualPool,
};
