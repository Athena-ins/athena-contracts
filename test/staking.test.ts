import chai, { expect } from "chai";
import hre from "hardhat";
import { BigNumber, Contract, ethers, ethers as ethersOriginal } from "ethers";
import weth_abi from "../abis/weth.json";
import chaiAsPromised from "chai-as-promised";

import {
  ATEN_TOKEN,
  ATEN_OWNER_ADDRESS,
  USDT,
  USDT_AAVE_ATOKEN,
  USDT_Wrong,
  WETH,
  AAVE_LENDING_POOL,
  AAVE_REGISTRY,
  NULL_ADDRESS,
  ARBITRATOR_ADDRESS,
  deployAndInitProtocol,
  increaseTimeAndMine,
} from "./helpers";

chai.use(chaiAsPromised);

let ATHENA_CONTRACT: ethersOriginal.Contract,
  POS_CONTRACT: ethersOriginal.Contract,
  STAKED_ATENS_CONTRACT: ethersOriginal.Contract,
  VAULT_ATENS_CONTRACT: ethersOriginal.Contract,
  STAKED_ATENS_CONTRACT_POLICY: ethersOriginal.Contract,
  FACTORY_PROTOCOL_CONTRACT: ethersOriginal.Contract,
  // AAVELP_CONTRACT: ethersOriginal.Contract,
  ATEN_TOKEN_CONTRACT: ethersOriginal.Contract = new Contract(
    ATEN_TOKEN,
    weth_abi
  ),
  POLICY_CONTRACT: ethersOriginal.Contract,
  allSigners: ethers.Signer[];

const USDT_TOKEN_CONTRACT = new ethers.Contract(USDT, weth_abi);

describe("Staking Policy Rewards", function () {
  before(async function () {
    allSigners = await hre.ethers.getSigners();
    [
      ATHENA_CONTRACT,
      POS_CONTRACT,
      STAKED_ATENS_CONTRACT,
      STAKED_ATENS_CONTRACT_POLICY,
      VAULT_ATENS_CONTRACT,
    ] = await deployAndInitProtocol(allSigners);
    console.log(
      "Address : ",
      ATHENA_CONTRACT.address,
      STAKED_ATENS_CONTRACT.address
    );

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xf977814e90da44bfa03b6295a0616a897441acec"],
    });
    const binanceSigner = await hre.ethers.getSigner(
      "0xF977814e90dA44bFA03b6295A0616a897441aceC"
    );

    const transfer = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      allSigners[1].getAddress(),
      ethers.utils.parseUnits("100000", 6)
    );
    expect(
      await USDT_TOKEN_CONTRACT.connect(allSigners[1]).balanceOf(
        allSigners[1].getAddress()
      )
    ).to.be.not.equal(BigNumber.from("0"));

    const transfer2 = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      allSigners[2].getAddress(),
      ethers.utils.parseUnits("100000", 6)
    );
    expect(
      await USDT_TOKEN_CONTRACT.connect(allSigners[2]).balanceOf(
        allSigners[2].getAddress()
      )
    ).to.equal(ethers.utils.parseUnits("100000", 6));

    const transfer3 = await USDT_TOKEN_CONTRACT.connect(binanceSigner).transfer(
      allSigners[3].getAddress(),
      ethers.utils.parseUnits("100000", 6)
    );
    expect(
      await USDT_TOKEN_CONTRACT.connect(allSigners[2]).balanceOf(
        allSigners[3].getAddress()
      )
    ).to.equal(ethers.utils.parseUnits("100000", 6));

    /** ATEN TOKENS  */
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ATEN_OWNER_ADDRESS],
    });
    const atenOwnerSigner = await hre.ethers.getSigner(ATEN_OWNER_ADDRESS);
    const ATEN_TOKEN_CONTRACT = new ethers.Contract(
      ATEN_TOKEN,
      weth_abi,
      atenOwnerSigner
    );
    await ATEN_TOKEN_CONTRACT.transfer(
      allSigners[0].getAddress(),
      ethers.utils.parseEther("10000000")
    );
    await ATEN_TOKEN_CONTRACT.transfer(
      allSigners[1].getAddress(),
      ethers.utils.parseEther("10000000")
    );
    await ATEN_TOKEN_CONTRACT.transfer(
      allSigners[2].getAddress(),
      ethers.utils.parseEther("10000000")
    );

    await ATEN_TOKEN_CONTRACT.transfer(
      allSigners[3].getAddress(),
      ethers.utils.parseEther("10000000")
    );
    await ATEN_TOKEN_CONTRACT.connect(allSigners[1]).approve(
      STAKED_ATENS_CONTRACT_POLICY.address,
      ethers.utils.parseEther("10000000")
    );
    await ATEN_TOKEN_CONTRACT.connect(allSigners[2]).approve(
      STAKED_ATENS_CONTRACT_POLICY.address,
      ethers.utils.parseEther("10000000")
    );

    await ATEN_TOKEN_CONTRACT.connect(allSigners[3]).approve(
      STAKED_ATENS_CONTRACT_POLICY.address,
      ethers.utils.parseEther("10000000")
    );
    await USDT_TOKEN_CONTRACT.connect(allSigners[1]).approve(
      ATHENA_CONTRACT.address,
      ethers.utils.parseEther("10000000")
    );
    await USDT_TOKEN_CONTRACT.connect(allSigners[2]).approve(
      ATHENA_CONTRACT.address,
      ethers.utils.parseEther("10000000")
    );

    await USDT_TOKEN_CONTRACT.connect(allSigners[3]).approve(
      ATHENA_CONTRACT.address,
      ethers.utils.parseEther("10000000")
    );
  });

  it("Should deposit ATENS in Vault", async function () {
    await ATEN_TOKEN_CONTRACT.connect(allSigners[0]).approve(
      VAULT_ATENS_CONTRACT.address,
      ethers.utils.parseEther("10000000")
    );
    await VAULT_ATENS_CONTRACT.connect(allSigners[0]).deposit(
      ethers.utils.parseEther("100000")
    );
  });

  it("Should set new active Protocol 0", async function () {
    const tx = await ATHENA_CONTRACT.connect(allSigners[0]).addNewProtocol(
      "Test protocol 0",
      30,
      [],
      "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunbbbbbbbbbbbbb"
    );
    expect(tx).to.haveOwnProperty("hash");
    const prot = await ATHENA_CONTRACT.connect(allSigners[0]).protocolsMapping(
      0
    );
    expect(prot.name).to.equal("Test protocol 0");
    const tx1bis = await ATHENA_CONTRACT.connect(allSigners[0]).addNewProtocol(
      "Test protocol 1",
      30,
      [],
      "bafybeiafebm3zdtzmn5mcquacgd47enhsjnebvegnzfunbbbbbbbbbbbbb"
    );

    const tx2 = await ATHENA_CONTRACT.connect(
      allSigners[0]
    ).setStakingRewardRates([
      [0, 1_000],
      [10_000, 1_200],
      [100_000, 1_600],
      [1_000_000, 2_000],
    ]);
  });

  it("should deposit capital for policy", async function () {
    const deposit = await ATHENA_CONTRACT.connect(allSigners[1]).deposit(
      ethers.utils.parseUnits("10000", 6),
      0,
      [0, 1]
    );
    await deposit.wait();
    expect(deposit).to.haveOwnProperty("hash");
  });

  it.skip("Should buy Policy", async function () {
    const policy = await ATHENA_CONTRACT.connect(allSigners[2]).buyPolicy(
      ethers.utils.parseUnits("1000", 6),
      ethers.utils.parseUnits("100", 6),
      0,
      0
    );
    await policy.wait();
    expect(policy).to.haveOwnProperty("hash");
  });

  it("Should fail to buy Policy with Atens cause too many ATENS", async function () {
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).buyPolicy(
        ethers.utils.parseUnits("1000", 6),
        ethers.utils.parseUnits("100", 6),
        ethers.utils.parseEther("20000"),
        0
      )
    ).to.eventually.be.rejectedWith("Too many ATENS");
  });

  it("Should buy Policy with Atens", async function () {
    const policy = await ATHENA_CONTRACT.connect(allSigners[2]).buyPolicy(
      ethers.utils.parseUnits("1000", 6),
      ethers.utils.parseUnits("100", 6),
      ethers.utils.parseEther("10000"),
      0
    );
    await policy.wait();
    expect(policy).to.haveOwnProperty("hash");
  });

  it("Should buy Policy 2 with Atens", async function () {
    const policy = await ATHENA_CONTRACT.connect(allSigners[2]).buyPolicy(
      ethers.utils.parseUnits("1000", 6),
      ethers.utils.parseUnits("100", 6),
      ethers.utils.parseEther("6000"),
      1
    );
    await policy.wait();
    expect(policy).to.haveOwnProperty("hash");
  });
  it("Should return remaining lock time ", async function () {
    const userStakes = await STAKED_ATENS_CONTRACT_POLICY.connect(
      allSigners[2]
    ).userStakes(allSigners[2].getAddress());
    console.log("User stakes", userStakes);

    expect(userStakes[1].timestamp.toNumber()).to.not.equal(0);
  });

  it("Should reject invalid withdraw Atens amount", async function () {
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).withdrawAtensPolicy(
        ethers.utils.parseEther("20000"),
        1
      )
    ).to.eventually.be.rejectedWith("Invalid amount");
  });

  it("Should lock ATENS on 1 year", async function () {
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).withdrawAtensPolicy(
        ethers.utils.parseEther("10000"),
        0
      )
    ).to.eventually.be.rejectedWith("Locked window");
  });

  it("Expect 12 months rewards for 100% APR", async function () {
    const rewards = await STAKED_ATENS_CONTRACT_POLICY.connect(
      allSigners[2]
    ).rewardsOf(allSigners[2].getAddress(), 0);
    expect(rewards.toNumber()).to.be.lessThanOrEqual(
      ethers.utils.parseEther("0.001").toNumber()
    );
    increaseTimeAndMine(60 * 60 * 24 * 365);
    const rewards2 = await STAKED_ATENS_CONTRACT_POLICY.connect(
      allSigners[2]
    ).rewardsOf(allSigners[2].getAddress(), 0);
    expect(rewards2.toString()).to.equal(
      ethers.utils.parseEther("10000").toString()
    );
  });
  it("Should return 2 staking Policy ", async function () {
    const indexUser = await STAKED_ATENS_CONTRACT_POLICY.connect(
      allSigners[2]
    ).stakes(allSigners[2].getAddress());
    expect(indexUser.index.toNumber()).to.equal(2);
  });
  it("Should unlock ATENS and withdraw after 1 year", async function () {
    await ATEN_TOKEN_CONTRACT.connect(allSigners[0]).transfer(
      STAKED_ATENS_CONTRACT_POLICY.address,
      ethers.utils.parseEther("100")
    );
    await ATEN_TOKEN_CONTRACT.connect(allSigners[0]).transfer(
      STAKED_ATENS_CONTRACT_POLICY.address,
      ethers.utils.parseEther("100")
    );
    const balBefore = await ATEN_TOKEN_CONTRACT.connect(
      allSigners[0]
    ).balanceOf(allSigners[2].getAddress());
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).withdrawAtensPolicy(
        ethers.utils.parseEther("10000"),
        0
      )
    ).to.eventually.haveOwnProperty("hash");
    const balAfter = await ATEN_TOKEN_CONTRACT.connect(allSigners[0]).balanceOf(
      allSigners[2].getAddress()
    );
    expect(balAfter.sub(balBefore).toString()).to.equal(
      ethers.utils.parseEther("10000").mul(99975).div(100000).mul(2).toString()
    );
    await expect(
      ATHENA_CONTRACT.connect(allSigners[2]).withdrawAtensPolicy(
        ethers.utils.parseEther("6000"),
        1
      )
    ).to.eventually.haveOwnProperty("hash");
  });
});
