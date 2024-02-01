import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function ClaimManager_changePeriods() {
  context("changePeriods", function () {
    before(async function () {
      this.args = {};
    });
  });
}
