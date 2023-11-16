import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";

const execPromise = promisify(exec);

function cleanLicences(contractName: string) {
  const path = `scripts/flat/${contractName}.sol`;
  const stringContract = fs
    .readFileSync(path, "utf8")
    .replace(/SPDX-License-/gm, "License-")
    .replace(/License-/m, "SPDX-License-")
    .replace(
      /\/\/ Sources flattened with hardhat v2.19.0 https:\/\/hardhat.org\n\n/m,
      ""
    );
  fs.writeFileSync(path, stringContract);
}

async function main() {
  console.log(`=> Going to flatten contracts`);

  // await execPromise("npx hardhat compile");

  if (!fs.existsSync("scripts/flat/")) {
    fs.mkdirSync("scripts/flat/");
  }

  await execPromise(
    "npx hardhat flatten contracts/CONTRACT.sol > scripts/flat/CONTRACT.sol"
  );

  // Remove all occurences of SPDX license identifiers except for the first one
  cleanLicences("CONTRACT");

  console.log("=> Flattened contracts\n");
}

// This pattern enables use of async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
