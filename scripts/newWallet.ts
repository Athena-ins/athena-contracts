import { ethers } from "ethers";

(async () => {
  try {
    while (true) {
      const wallet = ethers.Wallet.createRandom();
      if (wallet.address[2] === "A" && wallet.address[3] === "1") {
        console.log("WALLET address : " + wallet.address);
        console.log("WALLET PK : " + wallet.privateKey);
        console.log("WALLET Public : " + wallet.publicKey);
        return;
      }
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
