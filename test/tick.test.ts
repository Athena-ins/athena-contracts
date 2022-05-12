import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers as ethers_hardhat } from "hardhat";
import { BigNumber, ethers as ethers_ethers } from "ethers";

chai.use(chaiAsPromised);

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT

let allSigners: ethers_ethers.Signer[],
  owner: ethers_ethers.Signer,
  LibrariesTest: ethers_ethers.Contract;

describe("Ticks and TickBitmap", function () {
  before(async () => {
    allSigners = await ethers_hardhat.getSigners();
    owner = allSigners[0];
  });

  it("Should deploy contract", async function () {
    const factory = await ethers_hardhat.getContractFactory("LibrariesTest");
    LibrariesTest = await factory.deploy();

    await LibrariesTest.deployed();

    expect(
      await ethers_hardhat.provider.getCode("0x" + "0".repeat(40))
    ).to.equal("0x");

    expect(
      await ethers_hardhat.provider.getCode(LibrariesTest.address)
    ).to.not.equal("0x");
  });

  describe("TickBitmap", function () {
    it("Should check flipTick", async () => {
      let isInitialized = await LibrariesTest.isInitialized(200);
      expect(isInitialized).to.be.equal(false);

      await LibrariesTest.flipTick(200);
      isInitialized = await LibrariesTest.isInitialized(200);
      expect(isInitialized).to.be.equal(true);

      isInitialized = await LibrariesTest.isInitialized(199);
      expect(isInitialized).to.be.equal(false);

      await LibrariesTest.flipTick(199);
      isInitialized = await LibrariesTest.isInitialized(199);
      expect(isInitialized).to.be.equal(true);

      await LibrariesTest.flipTick(199);
      isInitialized = await LibrariesTest.isInitialized(199);
      expect(isInitialized).to.be.equal(false);

      isInitialized = await LibrariesTest.isInitialized(201);
      expect(isInitialized).to.be.equal(false);

      await LibrariesTest.flipTick(200);
      isInitialized = await LibrariesTest.isInitialized(200);
      expect(isInitialized).to.be.equal(false);
    });

    it("Should check nextInitializedTickInTheRightWithinOneWord", async () => {
      await LibrariesTest.flipTick(15);
      await LibrariesTest.flipTick(100);

      let [next, initialized] =
        await LibrariesTest.nextInitializedTickInTheRightWithinOneWord(99);
      expect(next).to.be.equal(BigNumber.from(100));
      expect(initialized).to.be.equal(true);

      [next, initialized] =
        await LibrariesTest.nextInitializedTickInTheRightWithinOneWord(100);
      expect(next).to.be.equal(BigNumber.from(255));
      expect(initialized).to.be.equal(false);

      await LibrariesTest.flipTick(254);
      [next, initialized] =
        await LibrariesTest.nextInitializedTickInTheRightWithinOneWord(100);
      expect(next).to.be.equal(BigNumber.from(254));
      expect(initialized).to.be.equal(true);

      await LibrariesTest.flipTick(15);
      await LibrariesTest.flipTick(100);
      await LibrariesTest.flipTick(254);
    });
  });

  describe("Ticks", function () {
    it("Should check pushTick and removeTick", async () => {
      await LibrariesTest.pushTick(100, 1000, 300, 150);
      let [capitalInsuredToRemove, emissionRateToRemove] =
        await LibrariesTest.crossTick(100, 100 * 150 * 350);
      expect(capitalInsuredToRemove).to.be.equal(BigNumber.from(1000));
      expect(emissionRateToRemove).to.be.equal(
        BigNumber.from(((100 * 150 * 350) / 150) * 300)
      );

      await LibrariesTest.pushTick(100, 2000, 700, 350);
      [capitalInsuredToRemove, emissionRateToRemove] =
        await LibrariesTest.crossTick(100, 100 * 150 * 350);
      expect(capitalInsuredToRemove).to.be.equal(BigNumber.from(1000 + 2000));
      expect(emissionRateToRemove).to.be.equal(
        BigNumber.from(
          ((100 * 150 * 350) / 150) * 300 + ((100 * 150 * 350) / 350) * 700
        )
      );

      let isInitialized = await LibrariesTest.isInitialized(100);
      expect(isInitialized).to.be.equal(true);

      await LibrariesTest.removeTick(100);
      isInitialized = await LibrariesTest.isInitialized(100);
      expect(isInitialized).to.be.equal(false);
    });
  });
});
