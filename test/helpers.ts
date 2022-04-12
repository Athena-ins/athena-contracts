import { BigNumber, ethers } from "ethers";
import hre from "hardhat";
import lendingPoolAbi from "../abis/lendingPool.json";
import weth_abi from "../abis/weth.json";

export const increaseTimeAndMine = async (secondsToIncrease: number) => {
  await hre.ethers.provider.send("evm_increaseTime", [secondsToIncrease]);
  await hre.ethers.provider.send("evm_mine", []);
};

export const getATokenBalance: (
  AAVE_LENDING_POOL: string,
  ATHENA_CONTRACT: ethers.Contract,
  stablecoin: string,
  user: ethers.Signer
) => Promise<BigNumber> = async (
  AAVE_LENDING_POOL,
  ATHENA_CONTRACT,
  stablecoin,
  user
) => {
  const AAVE_LENDING_POOL_CONTRACT = new ethers.Contract(
    AAVE_LENDING_POOL,
    lendingPoolAbi,
    user
  );
  // we fetch lending pool data for USDT to get aToken address
  const data = await AAVE_LENDING_POOL_CONTRACT.getReserveData(stablecoin);
  // and now check our aToken balance in contract
  const aTokenContract = new ethers.Contract(
    data.aTokenAddress,
    weth_abi,
    user
  );
  const bal = await aTokenContract.balanceOf(ATHENA_CONTRACT.address);
  return bal;
};
