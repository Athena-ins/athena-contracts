import { useConfig, useEthers } from "@usedapp/core";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { usePersistedState } from "./usePersistedState";
import { toast } from "react-toastify";

  const connector = new WalletConnect({
    bridge: "https://bridge.walletconnect.org", // Required
    qrcodeModal: QRCodeModal,
  });

  export const useWallet = () => {
    const {
      activateBrowserWallet,
      deactivate,
      account: metaAccount,
      error,
      chainId: chainIdEthers,
      library: ethersLibrary,
    } = useEthers();
    const config = useConfig();
    const [chainId, setChainId] = useState(0);
    const [account, setAccount] = usePersistedState(null, "account");
    const [provider, setProvider] = useState<
      ethers.providers.JsonRpcProvider | undefined
    >(undefined);
    const [isConnected, setIsConnected] = usePersistedState(false, "connected");
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
      let txSent;
      if (metaAccount === account && ethersLibrary) {
        //ethers Metamask tx
        txSent = await ethersLibrary.getSigner().sendTransaction(txData);
      } else {
        //Wallet connect TX,
        if (connector.clientMeta?.url.search("trustwallet.com") === -1) {
          txSent = await connector.sendTransaction(txData);
        } else {
          //Trust Wallet TX
          txSent = await connector.sendCustomRequest({
            method: "trust_signTransaction",
            params: [
              {
                network: 60,
                transaction: JSON.stringify(txData),
              },
            ],
          });
        }
      }

      const id = toast.info("Sending transaction...", { autoClose: 0 });

      console.log("Sent tx : ", txSent);
      const receipt = await txSent.wait?.();
      toast.update(id, {
        render: "Tx success " + receipt.transactionHash,
        type: "success",
        autoClose: 10000,
      });
      console.log("Receipt ? ", receipt);
      return receipt;
    };

    const disconnect = () => {
      connector.connected ? connector.killSession() : deactivate();
    };

    useEffect(() => {
      if (chainIdEthers) setChainId(chainIdEthers);
    }, [chainIdEthers]);

    useEffect(() => {
      setAccount(metaAccount || null);
      if (metaAccount && ethersLibrary) {
        setProvider(ethersLibrary);
      }
    }, [metaAccount]);

    useEffect(() => {
      if (
        !metaAccount &&
        account &&
        !ethersLibrary &&
        !provider &&
        config.readOnlyUrls
      )
        setProvider(
          new ethers.providers.JsonRpcProvider(config.readOnlyUrls[chainId])
        );
      else if (ethersLibrary) setProvider(ethersLibrary);
    }, [account]);

    useEffect(() => {
      init();
    }, []);

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

        console.log("Connector connected : ", connector.chainId);
        console.log("Connector connected : ", connector.accounts);
      }
      const provider = new ethers.providers.JsonRpcProvider(
        chainId === 1
          ? process.env.REACT_APP_MAINNET_URL
          : chainId === 4
          ? process.env.REACT_APP_RINKEBY_URL
          : ""
      );

      //  Enable session (triggers QR Code modal)
      setProvider(provider);
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
      console.log("Connector connected : ", obj, connector.accounts);
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
      console.log("Connector update : ", obj, connector.accounts);
    });

    connector.on("disconnect", (error, payload) => {
      if (error) {
        throw error;
      }
      console.log("Disconnect wallet Connect");
      setAccount(null);
      setChainId(0);

      // Delete connector
    });
    return {
      account,
      chainId,
      connected: isConnected,
      connectWC,
      connectMetamask: activateBrowserWallet,
      sendTx,
      provider,
      disconnect,
      error,
    };
  };
