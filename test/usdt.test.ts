import chai, { expect } from "chai";
import hre from "hardhat";
import { BigNumber, Contract, ethers, ethers as ethersOriginal } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

let allSigners: ethers.Signer[];
let CONTRACT: Contract;

describe("USDT Testnet mintable", function () {
  before(async function () {
    allSigners = await hre.ethers.getSigners();
  });

  it("Should deploy USDT Contract", async function () {
    const factory = await hre.ethers.getContractFactory("USDT");
    CONTRACT = await factory.deploy("USDT mintable testnet", "USDT", 6);
    await CONTRACT.deployed();
    await expect(
      hre.ethers.provider.getCode(CONTRACT.address)
    ).to.eventually.not.equal("0x");
  });

  it("Should mint TOKENS", async function () {
    await CONTRACT.connect(allSigners[0]).mint(
      ethers.utils.parseUnits("1000000", 6)
    );
    await expect(
      CONTRACT.connect(allSigners[0]).balanceOf(allSigners[0].getAddress())
    ).to.eventually.equal(ethers.utils.parseUnits("1000000", 6));
  });

  it("Should transfer tokens", async function () {
    await CONTRACT.connect(allSigners[0]).transfer(
      allSigners[1].getAddress(),
      ethers.utils.parseUnits("500000", 6)
    );
    await expect(
      CONTRACT.connect(allSigners[0]).balanceOf(allSigners[0].getAddress())
    ).to.eventually.equal(ethers.utils.parseUnits("500000", 6));
    await expect(
      CONTRACT.connect(allSigners[0]).balanceOf(allSigners[1].getAddress())
    ).to.eventually.equal(ethers.utils.parseUnits("500000", 6));
  });
});
