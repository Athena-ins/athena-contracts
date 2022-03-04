import { useEthers } from "@usedapp/core";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { usePersistedState } from "./usePersistedState";

export const useWallet = () => {
  let chainId: number | null = null;
  const {
    activateBrowserWallet,
    deactivate,
    account: metaAccount,
    error,
  } = useEthers();
  const [account, setAccount] = usePersistedState(null, "account");
  const [isConnected, setIsConnected] = usePersistedState(false, "connected");
  const [library, setlibrary] = useState<any>(undefined);

  const disconnect = () => {
    connector.connected ? connector.killSession() : deactivate();
  };

  useEffect(() => {
    setAccount(metaAccount || null);
  }, [metaAccount]);

  const connector = new WalletConnect({
    bridge: "https://bridge.walletconnect.org", // Required
    qrcodeModal: QRCodeModal,
  });

  const connectWC = () => {
    if (!connector.connected) connector.createSession();
    else {
      setIsConnected(true);
      setAccount(connector.accounts[0]);
      setlibrary(new ethers.providers.JsonRpcProvider(connector.rpcUrl));
    }
  };

  //   // Check if connection is already established
  //   if (!connector.connected) {
  //     // create new session
  //     connector.createSession();
  //   }

  if (connector.connected && !isConnected) {
    console.log("Connector already connected : ", connector.accounts);
    setIsConnected(true);
    setAccount(connector.accounts[0]);
  }

  connector.on("connect", (error, payload) => {
    if (error) {
      throw error;
    }
    setIsConnected(true);

    // Get provided accounts and chainId
    const obj = payload.params[0];
    setAccount(obj.accounts[0]);
    chainId = obj.chainId;
  });

  connector.on("session_update", (error, payload) => {
    if (error) {
      throw error;
    }

    // Get updated accounts and chainId
    const obj = payload.params[0];
    setAccount(obj.accounts[0]);
    if (connector.connected) setIsConnected(true);
    chainId = obj.chainId;
  });

  connector.on("disconnect", (error, payload) => {
    if (error) {
      throw error;
    }
    console.log("Disconnect wallet Connect");
    setAccount(null);

    // Delete connector
  });
  return {
    account,
    chainId,
    connected: isConnected,
    connectWC,
    connectMetamask: activateBrowserWallet,
    library,
    disconnect,
  };
};
