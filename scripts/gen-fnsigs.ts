import fs from "fs";
import { ethers } from "ethers";

import * as factories from "../typechain";

const toSigHash = (func: string) =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(func)).slice(0, 10);

const main = async () => {
  const fns = Object.values(factories)
    .map((factory) => Object.keys(factory.createInterface().functions))
    .flat();

  let sigs: any = fns.reduce(
    (acc, func) => ({
      ...acc,
      [func]: toSigHash(func),
    }),
    {}
  );

  fs.writeFileSync(
    "./test/helpers/signatureHashes.json",
    JSON.stringify(sigs, null, 2)
  );

  console.log(
    `\n=> Generated ${fns.length} signatures in test/helpers/signatureHashes.json\n`
  );
};

main();
