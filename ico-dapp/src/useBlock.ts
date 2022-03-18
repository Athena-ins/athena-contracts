import { JsonRpcProvider } from "@ethersproject/providers";
import { useEffect, useState } from "react";

export const useBlock = (provider?: JsonRpcProvider) => {
  const [blockNumber, setBlockNumber] = useState(0);
  useEffect(() => {
    if (provider)
      provider.on("block", (bln) => {
        console.log("New Block : ", bln);
        setBlockNumber(bln);
      });
  }, [provider?.network?.chainId]);

  return blockNumber;
};
