import { BigNumber } from "ethers";

export function deepCopy<T extends Object | Object[]>(source: T): T {
  if (!source) return source;

  const copied: any = Array.isArray(source) ? [] : {};

  for (const key in source) {
    const value = source[key];
    if (BigNumber.isBigNumber(value)) {
      copied[key] = BigNumber.from(value.toString());
    } else {
      copied[key] = typeof value === "object" ? deepCopy(value as any) : value;
    }
  }

  return copied;
}

export async function countdown(seconds = 10) {
  console.log("\n");
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`Countdown: ${i} seconds\r`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log("\n");
}

export function makeIdArray(length: number) {
  return [...Array(length).keys()];
}
