import fs from "fs";
import { ethers } from "hardhat";

export const distributeTokens = async (pathFile: string) => {
  const arrayToSend: Array<Array<string>> = [[], []];
  const file = fs.readFileSync(pathFile, "utf8");
  const data = file.split("\r\n");
  data.shift(); // Remove first line with header
  for (const line of data) {
    const allLine = line.split(",");
    let resolved: string | null = null;
    if (allLine[0].includes(".eth")) {
      resolved = await ethers.provider.resolveName(allLine[0]);
      if (!resolved)
        throw new Error("Could not get ENS address for " + allLine[0]);
    }
    const amount = Number(allLine[1].replaceAll('"', ""));

    if (amount === 0) continue;
    arrayToSend[0].push(
      ethers.utils.getAddress(resolved || allLine[0].toLocaleLowerCase())
    );
    arrayToSend[1].push(
      ethers.utils.parseUnits(Number(allLine[1]).toString(), 18).toString()
    );
  }
  return arrayToSend;
};
