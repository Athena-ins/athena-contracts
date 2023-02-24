import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const writeToClientFolder = process.env.EXPORT_TO_CLIENT === "true";

const abiPath = "artifacts/contracts/";
const rootPathExport = "typeExports";

let abiIndex = "";
let typechainIndex = "";

const genExports = async (
  targetList: { [key: string]: string },
  folder?: string,
  abiPathExport?: string,
  typechainPathExport?: string
) => {
  abiPathExport ??= `typeExports/ABI/${folder || ""}`;
  typechainPathExport ??= `typeExports/typechain/${folder || ""}`;

  if (writeToClientFolder) {
    if (!fs.existsSync(abiPathExport))
      throw Error("Client ABI folder not found");
    if (!fs.existsSync(typechainPathExport))
      throw Error("Client types folder not found");
  } else {
    if (!fs.existsSync(rootPathExport)) fs.mkdirSync(rootPathExport);
    if (!fs.existsSync(abiPathExport)) fs.mkdirSync(abiPathExport);
    if (!fs.existsSync(typechainPathExport)) fs.mkdirSync(typechainPathExport);
  }

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

  abiIndex = "";
  typechainIndex = "";

  if (writeToClientFolder) {
    console.log(`\n=> Files copied to ${folder}\n`);
  } else {
    console.log("\n=> Folders ready at typeExports/\n");
  }
};

// { common_name: subpath/?filename }
const targetListForUi = {
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
genExports(
  targetListForUi,
  "ui",
  "../athena-dapp/src/data/ABI/",
  "../athena-dapp/src/types/typechain/"
);

const targetListForApi = {
  Athena: "Athena",
  ClaimManager: "ClaimManager",
  CoverManager: "PolicyManager",
};
genExports(
  targetListForApi,
  "api",
  "../athena-api/src/abis/",
  "../athena-api/src/types/typechain/"
);
