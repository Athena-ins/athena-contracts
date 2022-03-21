import { useConfig, useEthers } from "@usedapp/core";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useBlock } from "./useBlock";

const connector = new WalletConnect({
  bridge: "https://bridge.walletconnect.org", // Required
  qrcodeModal: QRCodeModal,
});

export const useWallet = () => {
  const {
    activateBrowserWallet,
    deactivate,
    activate,
    account: metaAccount,
    error,
    chainId: chainIdEthers,
    library: ethersLibrary,
  } = useEthers();
  const config = useConfig();

  const [chainId, setChainId] = useState(0);
  const [account, setAccount] = useState<string | undefined>(undefined);
  const [provider, setProvider] = useState<
    ethers.providers.JsonRpcProvider | undefined
  >(undefined);
  const [isConnected, setIsConnected] = useState(false);
  // const [library, setlibrary] = useState<any>(undefined);

  /**
   * peerMeta:
chainId : 4
description: "MetaMask Mobile app"
icons: ['https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg']
name: "MetaMask"
ssl: true
url: "https://metamask.io"


chainId : 1
peerMeta:
description: null
icons: ['']
name: "Trust Wallet Android"
url: "https://trustwallet.com"
   */

  const sendTx = async (txData: any) => {
    const id = toast("Sending transaction...", {
      autoClose: false,
      type: "info",
    });
    try {
      let txSent;

      if (metaAccount === account && ethersLibrary) {
        //ethers Metamask tx
        txSent = await ethersLibrary.getSigner().sendTransaction(txData);
      } else {
        //Wallet connect TX,
        if (
          connector.clientMeta?.url.search("trustwallet.com") === -1 ||
          connector.peerMeta?.url.search("trustwallet.com") === -1
        ) {
          txSent = await connector.sendTransaction({
            ...txData,
            value: txData.value?.toString(),
          });
        } else {
          //Trust Wallet TX
          txSent = await connector.sendCustomRequest({
            method: "trust_signTransaction",
            params: [
              {
                network: 60,
                transaction: JSON.stringify({
                  ...txData,
                  value: txData.value?.toString(),
                }),
              },
            ],
          });
        }
      }

      toast.update(id, {
        render:
          "Tx sent " + (typeof txSent === "string" ? txSent : txSent.hash),
        type: "success",
        autoClose: 10000,
      });
      return txSent;
    } catch (error: any) {
      console.error(error);
      toast.update(id, {
        render:
          error.message.search("Amount requirements not met") !== -1
            ? "Amount should be between 200$ and 15000$"
            : "Tx failed : " + error.message,
        type: toast.TYPE.ERROR,
        className: "rotateY animated",
        autoClose: 10000,
      });
      return;
    }
  };

  const disconnect = () => {
    connector.connected ? connector.killSession() : deactivate();
  };

  useEffect(() => {
    if (chainIdEthers) setChainId(chainIdEthers);
  }, [chainIdEthers]);

  useEffect(() => {
    setProviderConfig();
  }, [chainId]);

  useEffect(() => {
    setAccount(metaAccount || undefined);
    setProviderConfig();
  }, [metaAccount]);

  useEffect(() => {
    init();
  }, []);

  const setProviderConfig = () => {
    provider?.removeAllListeners();
    if (!config.readOnlyUrls) return;
    const prov =
      metaAccount === account && ethersLibrary
        ? ethersLibrary
        : new ethers.providers.JsonRpcProvider(config.readOnlyUrls[chainId]);
    if (connector.connected) {
      activate(prov);
    }
    setProvider(prov);
  };

  const init = async () => {
    if (connector.connected && !isConnected) {
      console.log("Connector already connected : ", connector.accounts);
      setIsConnected(true);
      setAccount(connector.accounts[0]);
      setChainId(connector.chainId);
    }
  };

  const connectWC = async () => {
    if (!connector.connected) await connector.createSession();
    else {
      setIsConnected(true);
      setAccount(connector.accounts[0]);
      setChainId(connector.chainId);
    }
    // setlibrary(new ethers.providers.Web3Provider(provider));
  };

  connector.on("connect", async (error, payload) => {
    if (error) {
      throw error;
    }
    setIsConnected(true);

    // Get provided accounts and chainId
    const obj = payload.params[0];
    setAccount(obj.accounts[0]);
    setChainId(obj.chainId);
  });

  connector.on("session_update", (error, payload) => {
    if (error) {
      throw error;
    }

    // Get updated accounts and chainId
    const obj = payload.params[0];
    setAccount(obj.accounts[0]);
    setIsConnected(connector.connected);
    setChainId(obj.chainId);
  });

  connector.on("disconnect", (error, payload) => {
    if (error) {
      throw error;
    }
    console.log("Disconnect wallet Connect");
    setAccount(undefined);
    setChainId(0);
    provider?.removeAllListeners();
    setProvider(undefined);
    setIsConnected(false);

    connector.killSession();

    // Delete connector
  });
  return {
    account,
    chainId,
    connectWC,
    connectMetamask: activateBrowserWallet,
    sendTx,
    provider,
    disconnect,
    error,
  };
};
