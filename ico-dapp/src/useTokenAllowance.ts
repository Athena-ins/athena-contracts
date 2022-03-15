import { BigNumber, ethers } from "ethers";
import { useEffect, useState } from "react";
import erc20abi from "./erc20abi.json";

export function useTokenAllowance(
  address: string | null | undefined,
  account: string | null | undefined,
  spender: string | null | undefined,
  provider: ethers.providers.JsonRpcProvider | undefined
): BigNumber | undefined {
  const [tokenAllowance, setTokenAllowance] = useState<BigNumber | undefined>(
    undefined
  );
  useEffect(() => {
    if (address && provider?.network?.chainId) getAllowance();
    else setTokenAllowance(BigNumber.from("0"));
  }, [provider?.network?.chainId, address]);

  const getAllowance = async () => {
    if (!address || !spender || !account || !provider?.network?.chainId)
      return setTokenAllowance(BigNumber.from("0"));
    const contract = new ethers.Contract(address, erc20abi).connect(provider);
    const bal = await contract.allowance(account, spender);
    setTokenAllowance(bal);
  };

  return tokenAllowance;
}
