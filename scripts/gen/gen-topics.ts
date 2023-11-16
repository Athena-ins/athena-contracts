import fs from "fs";
import { ethers } from "ethers";

import * as factories from "../../typechain";

const toHash = (func: string) =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(func));

const genEventTopics = async () => {
  const fns = Object.values(factories)
    .map((factory) => Object.keys(factory.createInterface().events))
    .flat();

  let sigs: any = fns.reduce(
    (acc, func) => ({
      ...acc,
      [func]: toHash(func),
    }),
    {}
  );

  fs.writeFileSync(
    "./tests/registries/eventTopics.json",
    JSON.stringify(sigs, null, 2)
  );

  console.log(
    `\n=> Generated ${fns.length} event topics in tests/registries/eventTopics.json\n`
  );
};

genEventTopics();
