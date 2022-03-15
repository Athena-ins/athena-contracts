import { BigNumber, ethers } from "ethers";
import { useEffect, useState } from "react";
import erc20abi from "./erc20abi.json";

export function useTokenBalance(
  address: string | null | undefined,
  account: string | null | undefined,
  provider: ethers.providers.JsonRpcProvider | undefined
): BigNumber | undefined {
  const [tokenBalance, setTokenBalance] = useState<BigNumber | undefined>(
    undefined
  );
  useEffect(() => {
    getBalance();
  }, [provider?.network?.chainId, address, account]);

  const getBalance = async () => {
    try {
      if (!address || !account || !provider?.network?.chainId)
        return setTokenBalance(BigNumber.from("0"));
      const contract = new ethers.Contract(address, erc20abi).connect(provider);
      const bal = await contract.balanceOf(account);
      setTokenBalance(bal);
    } catch (error) {
      setTokenBalance(BigNumber.from("0"));
      console.error(
        "Error useTokenBalance : ",
        address,
        account,
        provider?.network?.chainId,
        error
      );
    }
  };

  return tokenBalance;
}
