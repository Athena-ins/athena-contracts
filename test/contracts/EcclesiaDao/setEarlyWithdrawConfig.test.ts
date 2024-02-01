import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function EcclesiaDao_setEarlyWithdrawConfig() {
  context("setEarlyWithdrawConfig", function () {
    before(async function () {
      this.args = {};
    });
  });
}
