import { BigNumber, ethers } from "ethers";
import { useEffect, useState } from "react";

export function useEtherBalance(
  address: string | null | undefined,
  provider: ethers.providers.JsonRpcProvider | undefined
): BigNumber | undefined {
  const [etherBalance, setEtherBalance] = useState<BigNumber | undefined>(
    undefined
  );
  useEffect(() => {
    if (address && provider?.network) getBalance();
    else setEtherBalance(BigNumber.from("0"));
  }, [provider?.network?.chainId, address]);

  const getBalance = async () => {
    const eth = address
      ? await provider?.getBalance(address)
      : BigNumber.from("0");
    setEtherBalance(eth);
  };

  return etherBalance;
}
