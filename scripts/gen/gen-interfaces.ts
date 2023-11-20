import fs from "fs";
import { License } from "./helpers/licenceType";
import { SolcVersion } from "./helpers/solcVersionType";

const emptyInterface = (
  filename: string,
  licence: string,
  solidityVersion: string,
) => {
  return `// SPDX-License-Identifier: ${licence}
  pragma solidity ^${solidityVersion};
  
  interface I${filename} {
    xxSTRUCTSxx\n`;
};

const closeInterface = (content: string) => {
  return `${content}
}`;
};

function getInOrOut(inputs: any) {
  let out = "";
  const structures: any = [];
  for (let i = 0; i < inputs.length; i += 1) {
    if (
      (inputs[i].type == "tuple" || inputs[i].type == "tuple[]") &&
      inputs[i].internalType.includes("struct")
    ) {
      const structName = inputs[i].internalType.slice(
        inputs[i].internalType.indexOf(".") + 1,
      );

      structures.push({ ...inputs[i], structName: structName });

      out += structName;
      out += " memory";
    } else {
      if (inputs[i].type) out += inputs[i].type;

      if (
        inputs[i].type.includes("[") ||
        inputs[i].type == "string" ||
        inputs[i].type == "bytes"
      ) {
        out += " calldata";
      }

      if (inputs[i].name) {
        out += ` ${inputs[i].name}`;
      }
    }

    if (i !== inputs.length - 1) {
      out += ", ";
    }
  }
  return [out, structures];
}

function getMethodInterface(method: any): [string, any[]] {
  const out = [];
  const structures: any[] = [];
  // Type
  // Interfaces limitation: https://solidity.readthedocs.io/en/v0.4.24/contracts.html#interfaces
  if (method.type !== "function") {
    return ["", []];
  }
  out.push(method.type + " ");
  // Name
  if (method.name) {
    out.push(method.name);
  }
  // Inputs
  out.push("(");
  if (method.inputs.length) {
    const [params, structs] = getInOrOut(method.inputs);
    out.push(params);
    structures.push(structs);
  }
  out.push(") ");
  // Functions in ABI are either public or external and there is no difference in the ABI
  out.push("external ");
  // State mutability
  if (method.stateMutability === "pure") {
    out.push("pure ");
  } else if (method.stateMutability === "view") {
    out.push("view ");
  } else if (method.stateMutability === "pure") {
    out.push("pure ");
  }
  // Payable
  if (method.payable) {
    out.push("payable ");
  }
  // Outputs
  if (method.outputs && method.outputs.length > 0) {
    out.push("returns ");
    out.push("(");
    const [params, structs] = getInOrOut(method.outputs);
    out.push(params);
    structures.push(structs);
    out.push(")");
  }
  return [out.join(""), structures.flat()];
}

function writeInterfaceContent(
  abi: any[],
  filename: string,
  licence: string,
  solidityVersion: string,
) {
  let output = emptyInterface(filename, licence, solidityVersion);

  let rawStructures: any[] = [];
  console.log("abi: ", JSON.stringify(abi, undefined, 2));
  for (const element of abi) {
    const [methodString, structures] = getMethodInterface(element);

    if (structures.length) rawStructures.push(...structures);

    if (methodString) {
      // const [methodString, structures] = getMethodInterface(element);
      output += `  ${getMethodInterface(element)[0]};\n`;
    }
  }

  const structsDone: any = {};
  if (rawStructures.flat().length) {
    const structTextArray = rawStructures.flat().map((struct: any) => {
      if (structsDone[struct.structName]) {
        return "";
      } else {
        structsDone[struct.structName] = true;

        if (struct.structName.includes("[]")) {
          struct.structName = struct.structName.slice(
            0,
            struct.structName.length - 2,
          );
        }

        return `struct ${struct.structName} {
          ${struct.components
            .map((entry: any) => `  ${entry.type} ${entry.name}`)
            .join(";\n")};
          }\n`;
      }
    });

    output = output.replace("xxSTRUCTSxx", structTextArray.join(" "));
  } else {
    output = output.replace("xxSTRUCTSxx", "");
  }

  return closeInterface(output);
}

function manageInterfaceFile(
  data: { name: string; abi: any[] },
  licence: string,
  solidityVersion: string,
) {
  try {
    const interfaceFile: string = writeInterfaceContent(
      data.abi,
      data.name,
      licence,
      solidityVersion,
    );

    const outPath = `contracts/interfaces/I${data.name}.sol`;
    fs.writeFileSync(outPath, interfaceFile);

    console.log(`\u001b[32mI${data.name}.sol = ok\u001b[0m`);
  } catch (err: any) {
    console.log(`\u001b[31mI${data.name}.sol = ERROR\u001b[0m`);
    console.log(err);
  }
}

export const genInterfaces = async (
  targetContracts?: string[],
  targetLicence?: License,
  targetSolcVersion?: SolcVersion,
) => {
  const contracts = targetContracts ?? ["Token"];
  const licence = targetLicence ?? "MIT";
  const solidityVersion = targetSolcVersion ?? "0.8.0";

  if (!fs.existsSync("typechain/factories/")) {
    throw Error("Typechain files not found");
  }

  const allFiles = fs.readdirSync("typechain/factories/");

  // const abis = allFiles.reduce((acc, file) => {
  //   const name = file;
  //   const isInterface = false;
  //   // const abi = await import(`../typechain/factories/${file}`).abi;
  //   return [...acc, []] as any;
  // }, []);

  const abiData = [];
  for (const file of allFiles) {
    const filename = file.slice(0, file.lastIndexOf("__factory"));
    const isInterface =
      filename[0] === "I" && filename[1] === filename[1].toUpperCase();

    if (isInterface) continue;

    if (contracts.includes("*") || contracts.includes(filename)) {
      const factory = await import(`../../typechain/factories/${file}`);
      const abi = factory[Object.keys(factory)[0]].abi;
      abiData.push({ name: filename, abi });
    }
  }

  console.log(
    `\n==> Found ${abiData.length} ABIs among ${allFiles.length} files\n`,
  );
  for (const data of abiData)
    manageInterfaceFile(data, licence, solidityVersion);
};

genInterfaces();
