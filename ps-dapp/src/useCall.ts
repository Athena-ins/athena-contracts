import { ethers } from "ethers";
import { useEffect, useState } from "react";

export function useCall(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[],
  provider: ethers.providers.JsonRpcProvider | undefined
): any[] | undefined {
  const [argsResp, setArgsResp] = useState<any[]>([]);
  useEffect(() => {
    call();
  }, [provider?.network?.chainId, contractAddress]);

  useEffect(() => {
    call();
  }, [...args]);

  const call = async () => {
    try {
      if (!contractAddress || !provider?.network?.chainId)
        return setArgsResp([]);
      const contract = new ethers.Contract(contractAddress, abi).connect(
        provider
      );
      const result = await contract.callStatic[functionName](args);
      setArgsResp([result]);
    } catch (error) {
      setArgsResp([]);
      console.error(
        "Error useCall : ",
        contractAddress,
        functionName,
        args,
        provider?.network?.chainId,
        error
      );
    }
  };

  return argsResp;
}
