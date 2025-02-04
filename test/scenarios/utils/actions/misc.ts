import { expect } from "chai";
import {
  convertToCurrencyDecimals,
  setNextBlockTimestamp,
} from "../../../helpers/hardhat";
// Types
import { BigNumberish, ContractReceipt, Wallet } from "ethers";
import { ERC20__factory } from "../../../../typechain";
import { TestEnv } from "../../../context";
import { TimeTravelOptions } from "../../../helpers/hardhat";

// ======= ACTIONS ======= //

export async function waitFor(timeTravel: TimeTravelOptions) {
  if (timeTravel) {
    await setNextBlockTimestamp(timeTravel);
  }
}

export async function getTokens(
  testEnv: TestEnv,
  tokenSymbol: string,
  to: Wallet,
  amount: BigNumberish,
) {
  const { TetherToken, AthenaToken, CircleToken } = testEnv.contracts;
  const { getUsdt, getAten, getUsdc } = testEnv.helpers;

  let tokenAddress: string;
  let getterFunction: (
    to: string,
    value: BigNumberish,
  ) => Promise<ContractReceipt>;

  if (tokenSymbol === "USDT")
    [tokenAddress, getterFunction] = [TetherToken.address, getUsdt];
  else if (tokenSymbol === "USDC")
    [tokenAddress, getterFunction] = [CircleToken.address, getUsdc];
  else if (tokenSymbol === "ATEN")
    [tokenAddress, getterFunction] = [AthenaToken.address, getAten];
  else throw Error("Token not found");

  const token = ERC20__factory.connect(tokenAddress, to);
  const toAddress = await to.getAddress();

  const [balanceBefore, weiAmount] = await Promise.all([
    token.balanceOf(toAddress),
    convertToCurrencyDecimals(tokenAddress, amount),
  ]);

  await getterFunction(toAddress, weiAmount);

  const balanceAfter = await token.balanceOf(toAddress);
  expect(balanceAfter).to.equal(balanceBefore.add(weiAmount));
}

export async function approveTokens(
  testEnv: TestEnv,
  tokenSymbol: string,
  from: Wallet,
  spender: string,
  amount: BigNumberish,
) {
  const { TetherToken, AthenaToken, CircleToken } = testEnv.contracts;
  const { approveUsdt, approveAten, approveUsdc } = testEnv.helpers;

  let tokenAddress: string;
  let approveFunction: (
    signer: Wallet,
    spender: string,
    value: BigNumberish,
  ) => Promise<ContractReceipt>;

  if (tokenSymbol === "USDT")
    [tokenAddress, approveFunction] = [TetherToken.address, approveUsdt];
  else if (tokenSymbol === "USDC")
    [tokenAddress, approveFunction] = [CircleToken.address, approveUsdc];
  else if (tokenSymbol === "ATEN")
    [tokenAddress, approveFunction] = [AthenaToken.address, approveAten];
  else throw Error("Token not found");

  const token = ERC20__factory.connect(tokenAddress, from);
  const fromAddress = await from.getAddress();
  const weiAmount = await convertToCurrencyDecimals(tokenAddress, amount);

  await approveFunction(from, spender, weiAmount);

  const allowanceAfter = await token.allowance(fromAddress, spender);
  expect(allowanceAfter).to.equal(weiAmount);
}
