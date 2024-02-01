import { expect } from "chai";
// Helpers
import { setNextBlockTimestamp, postTxHandler } from "../../helpers/hardhat";
import { toUsd, toErc20, makeIdArray } from "../../helpers/protocol";
// Types

export function VirtualPool__coverInfo() {
  context("_coverInfo", function () {
    before(async function () {
      this.args = {};
    });
  });
}
