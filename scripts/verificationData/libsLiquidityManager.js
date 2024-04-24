const { getNetworkAddresses } = require("./addresses");

const { AthenaDataProvider, VirtualPool } = getNetworkAddresses();

module.exports = {
  ["src/libs/VirtualPool.sol:VirtualPool"]: VirtualPool,
  ["src/misc/AthenaDataProvider.sol:AthenaDataProvider"]: AthenaDataProvider,
};
