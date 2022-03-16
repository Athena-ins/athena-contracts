import { BigNumber, ethers } from "ethers";
import { useEffect, useState } from "react";

export function useEtherBalance(
  address: string | null | undefined,
  provider: ethers.providers.JsonRpcProvider | undefined
): BigNumber | undefined {
  const [etherBalance, setEtherBalance] = useState<BigNumber | undefined>(
    undefined
  );
  const chaindIdProvider = provider?.network?.chainId;
  useEffect(() => {
    if (chaindIdProvider) getBalance();
    else setEtherBalance(BigNumber.from("0"));
  }, [chaindIdProvider, address]);

  const getBalance = async () => {
    const eth = address
      ? await provider?.getBalance(address)
      : BigNumber.from("0");
    setEtherBalance(eth);
  };

  return etherBalance;
}
