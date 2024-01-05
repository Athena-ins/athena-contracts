import { expect } from "chai";
import hre, { ethers } from "hardhat";
// Helpers
import {
  deployMockArbitrator,
  deployAthenaCoverToken,
  deployAthenaPositionToken,
  deployAthenaToken,
  deployClaimManager,
  deployEcclesiaDao,
  deployLiquidityManager,
  deployRewardManager,
  deployStrategyManager,
  deployAllContractsAndInitializeProtocol,
} from "../helpers/deployers";
import { genContractAddress, getCurrentBlockNumber } from "../helpers/hardhat";
// Types
import { BaseContract } from "ethers";

export function liquidityManagerTest() {
  context("Liquidity Manager", function () {
    before(async function () {});

    it("can create pools", function () {});

    it("accepts LPs", function () {});
    it("accepts covers", function () {});

    it("has coherent state", function () {});
    it("has lasting coherent state ", function () {});

    it("can update LPs", function () {});
    it("can update cover", function () {});

    it("has coherent state", function () {});
    it("has lasting coherent state", function () {});

    it("can close cover", function () {});
    it("can close LPs", function () {});

    it("has coherent state", function () {});
    it("has lasting coherent state", function () {});
  });
}
