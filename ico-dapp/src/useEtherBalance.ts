import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useWallet } from "./useWallet";

export function useEtherBalance(
  address: string | null | undefined
): BigNumber | undefined {
  const { provider } = useWallet();
  const [etherBalance, setEtherBalance] = useState<BigNumber | undefined>(
    undefined
  );

  useEffect(() => {
    if (address && provider?.network) getBalance();
    else setEtherBalance(undefined);
  }, [provider, address]);

  const getBalance = async () => {
    const eth = address
      ? await provider?.getBalance(address)
      : BigNumber.from("0");
    setEtherBalance(eth);
  };

  return etherBalance;
}
