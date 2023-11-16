import fs from "fs";
import { ethers } from "ethers";

import * as factories from "../../typechain";

const toHash = (func: string) =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(func));

const genFnSigs = async () => {
  const fns = Object.values(factories)
    .map((factory) => Object.keys(factory.createInterface().functions))
    .flat();

  let sigs: any = fns.reduce(
    (acc, func) => ({
      ...acc,
      [func]: toHash(func).slice(0, 10),
    }),
    {}
  );

  fs.writeFileSync(
    "./tests/registries/signatureHashes.json",
    JSON.stringify(sigs, null, 2)
  );

  console.log(
    `\n=> Generated ${fns.length} signatures in tests/registries/signatureHashes.json\n`
  );
};

genFnSigs();
