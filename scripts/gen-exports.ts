import fs from "fs";

const abiPath = "artifacts/contracts/";
const rootPathExport = "./uiExport";
const abiPathExport = "./uiExport/ABI/";
const typechainPathExport = "./uiExport/typechain/";

// { common_name: subpath/?filename }
const targetList = {
  Athena: "Athena",
  AtenToken: "erc20/ATEN",
  UsdtToken: "erc20/USDT",
  ClaimManager: "ClaimManager",
  PolicyManager: "PolicyManager",
  PositionsManager: "PositionsManager",
  StakingGeneralPool: "StakingGeneralPool",
  StakingPolicy: "StakingPolicy",
  TokenVault: "TokenVault",
  PriceOracleV1: "PriceOracleV1",
};

let abiIndex = "";
let typechainIndex = "";

const main = async () => {
  if (!fs.existsSync(rootPathExport)) fs.mkdirSync(rootPathExport);
  if (!fs.existsSync(abiPathExport)) fs.mkdirSync(abiPathExport);
  if (!fs.existsSync(typechainPathExport)) fs.mkdirSync(typechainPathExport);

  Object.entries(targetList).map(async ([name, path]) => {
    const file = path.replace(/^.*[\\\/]/, "");
    console.log("file: ", file);

    // ABI

    const abiJson = fs.readFileSync(
      `${abiPath}${path}.sol/${file}.json`,
      "utf8"
    );
    const abi = JSON.parse(abiJson).abi;
    fs.writeFileSync(
      `${abiPathExport}${name}.json`,
      JSON.stringify(abi, null, 2)
    );

    abiIndex += `import ${name}ABI from "./${name}.json";\n`;

    // Typechain

    fs.copyFileSync(
      `./typechain/${file}.d.ts`,
      `${typechainPathExport}${file}.d.ts`
    );

    typechainIndex += `export { ${file} } from "./${file}";\n`;
  });

  abiIndex += `\nexport {${Object.entries(targetList)
    .map(([name]) => `\n  ${name}ABI`)
    .join(",")}\n};`;

  fs.writeFileSync(`${abiPathExport}index.ts`, abiIndex);
  fs.writeFileSync(`${typechainPathExport}index.ts`, typechainIndex);

  console.log("\n=> Folders ready at ./uiExport\n");
};

main();
