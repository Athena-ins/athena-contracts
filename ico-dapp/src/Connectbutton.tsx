// ConnectButton.tsx
import { useEthers, useEtherBalance, getChainById } from "@usedapp/core";
import { formatEther } from "@ethersproject/units";
import { Button, NotificationIconContainer } from "./Components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faLinkSlash } from "@fortawesome/free-solid-svg-icons";
import CSS from "csstype";

export default function ConnectButton({
  className,
  style,
  account,
  connectWC,
  connectMetamask,
  disconnect,
  chainId,
}: {
  className?: string;
  style?: CSS.Properties;
  account?: string;
  chainId?: number;
  connectWC?: () => void;
  connectMetamask?: () => void;
  disconnect?: () => void;
}) {
  const etherBalance = useEtherBalance(account);

  return account ? (
    <div
      className={className}
      style={
        !className
          ? {
              display: "flex",
              alignItems: "center",
              background: "#333333",
              borderRadius: 8,
              padding: "8px",
              margin: "1px",
              ...style,
            }
          : {
              display: "flex",
              alignItems: "center",
              padding: "8px",
              margin: "1px",
              ...style,
            }
      }
    >
      <div style={{ margin: 4 }}>
        <span color="white">
          {etherBalance && parseFloat(formatEther(etherBalance)).toFixed(3)} ETH
        </span>
      </div>
      <Button
        // className={className}
        style={{
          background: "gray",
          borderRadius: 8,
          border: 0,
          // height: "32px",
          display: "flex",
          alignItems: "center",
        }}
        onClick={disconnect}
      >
        <span style={{ margin: 2, color: "white", padding: 1 }}>
          {account &&
            `${account.slice(0, 6)}...${account.slice(
              account.length - 4,
              account.length
            )}`}
        </span>
      </Button>
      {typeof chainId === "number" && (
        <span
          style={{
            paddingLeft: 8,
            color: [1, 4].includes(chainId) ? "inherit" : "red",
          }}
        >
          {[1, 4].includes(chainId) ? (
            <span>
              <FontAwesomeIcon icon={faLink}></FontAwesomeIcon>
              {getChainById(chainId)?.chainName}
            </span>
          ) : (
            <span>
              <FontAwesomeIcon icon={faLinkSlash}></FontAwesomeIcon>
              Wrong network
            </span>
          )}
        </span>
      )}
    </div>
  ) : (
    <div style={style}>
      <Button
        className={className}
        onClick={connectMetamask}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#f8901c",
        }}
      >
        <img src="img/metamask.png" width="100px" alt="logo" />
        Metamask
      </Button>
      <Button
        className={className}
        onClick={connectMetamask}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 16,
        }}
      >
        <img src="img/trustwallet.png" height="90px" alt="logo" />
      </Button>
      <Button
        className={className}
        onClick={() => connectWC?.()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 16,
          color: "#3b99fc",
        }}
      >
        <img height="60px" src="img/walletconnect.png" />
        Wallet Connect
      </Button>
    </div>
  );
}
