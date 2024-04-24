const { getNetworkAddresses } = require("./addresses");

const { PoolMath } = getNetworkAddresses();

module.exports = {
  ["src/libs/PoolMath.sol:PoolMath"]: PoolMath,
};
