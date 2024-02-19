import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types
import { BigNumber } from "ethers";

interface Arguments extends Mocha.Context {
  args: {};
}

export function FarmingRange_forceExpiredCoverWithdrawal() {
  context("forceExpiredCoverWithdrawal", function (this: Arguments) {
    before(async function (this: Arguments) {
      this.args = {};
    });
  });
}
